const assert = require('node:assert/strict');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { chromium } = require(process.env.WATERDASH_PLAYWRIGHT_MODULE || 'playwright');

const projectId = 'waterdash-emulator';
const baseUrl = process.env.WATERDASH_BROWSER_URL || 'http://127.0.0.1:4173';
const allowedHosts = new Set(['127.0.0.1', 'localhost', '::1']);
let passed = 0;

function localHost(value, name) {
  const host = String(value || '').split(':')[0].replace(/^\[|\]$/g, '');
  if (!allowedHosts.has(host)) throw new Error(`${name} must be loopback; refusing browser test.`);
}

function check(value, label) {
  assert.ok(value, label);
  passed += 1;
}

async function upsertUser(auth, email, role, disabled = false) {
  let user;
  try { user = await auth.getUserByEmail(email); }
  catch { user = await auth.createUser({ email, password: 'Safe-Emulator-Only-1!', disabled: false }); }
  await auth.updateUser(user.uid, { disabled });
  await auth.setCustomUserClaims(user.uid, { waterdashRole: role });
  return user;
}

async function seed() {
  localHost(process.env.FIREBASE_AUTH_EMULATOR_HOST, 'FIREBASE_AUTH_EMULATOR_HOST');
  localHost(process.env.FIRESTORE_EMULATOR_HOST, 'FIRESTORE_EMULATOR_HOST');
  localHost(new URL(baseUrl).hostname, 'WATERDASH_BROWSER_URL');
  const app = getApps()[0] || initializeApp({ projectId });
  const auth = getAuth(app);
  await Promise.all([
    upsertUser(auth, 'superadmin@example.test', 'superAdmin'),
    upsertUser(auth, 'supervisor@example.test', 'supervisor'),
    upsertUser(auth, 'dataentry@example.test', 'dataEntry'),
    upsertUser(auth, 'viewer@example.test', 'viewer'),
    upsertUser(auth, 'disabled@example.test', 'viewer', true)
  ]);
  const db = getFirestore(app);
  await db.collection('settings').doc('main').set({ appName: 'WaterDash Emulator', defaultStationName: 'المحطة التجريبية' });
  await db.collection('stations').doc('main').set({ name: 'المحطة التجريبية', active: true });
  await db.collection('fuelEntries').doc('incoming-1056').set({ type: 'incoming', date: '2026-08-22', time: '08:00', quantityLiters: 1056, supplier: 'fixture' });
  await db.collection('reports').doc('historical-21').set({ reportDate: '2026-08-21', title: 'تقرير تاريخي', generator: { totalRunHours: '6:00' }, fuel: { consumedDaily: 114, previousBalance: '', currentBalance: '' }, water: { filteredRate: 33 }, beneficiaries: [] });
  await db.collection('reports').doc('current-22').set({ reportDate: '2026-08-22', title: 'تقرير دورة الوقود', generator: { totalRunHours: '12:00' }, fuel: { consumedDaily: 228, previousBalance: 1056, currentBalance: 828 }, water: { filteredRate: 33 }, beneficiaries: [] });
}

async function main() {
  await seed();
  console.log('BROWSER_STEP=seeded');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.WATERDASH_BROWSER_EXECUTABLE || undefined });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const location = message.location();
    const expectedInvalidLogin = location.url.startsWith('http://127.0.0.1:9099/') && message.text().includes('Failed to load resource');
    if (!expectedInvalidLogin) errors.push(message.text());
  });
  page.on('request', request => requests.push(request.url()));
  await context.addInitScript(() => {
    window.WATER_APP_FIREBASE_CONFIG = { apiKey: 'emulator-only-key', authDomain: 'waterdash-emulator.firebaseapp.com', projectId: 'waterdash-emulator', appId: 'emulator-only-app' };
    window.WATER_APP_EMULATOR = { enabled: true, host: '127.0.0.1', authPort: 9099, firestorePort: 8080 };
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  console.log('BROWSER_STEP=loaded');
  await page.waitForSelector('#loginUsername');
  check(await page.evaluate(() => window.WATER_APP_RUNTIME?.mode === 'emulator'), 'runtime reports emulator mode');
  await page.fill('#loginUsername', 'invalid@example.test');
  await page.fill('#loginPassword', 'wrong-password');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(500);
  check(await page.locator('#loginUsername').isVisible(), 'invalid login remains unauthenticated');

  await page.fill('#loginUsername', 'superadmin@example.test');
  await page.fill('#loginPassword', 'Safe-Emulator-Only-1!');
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction(() => window.AuthUsers?.currentUser?.()?.role === 'superAdmin' && window.App?.state?.reports?.length >= 2);
  console.log('BROWSER_STEP=authenticated');
  check(await page.evaluate(() => window.WATER_APP_RUNTIME?.host === '127.0.0.1'), 'runtime uses loopback emulator host');
  check(await page.evaluate(() => window.App.state.reports.some(report => report.reportDate === '2026-08-22')), 'dashboard loaded emulator reports');
  check(await page.evaluate(() => window.App.state.reports.find(report => report.reportDate === '2026-08-21')?.fuel?.currentBalance !== -3059.77), 'historical invalid balance is absent');
  await page.waitForFunction(() => Array.isArray(window.WaterFuelRawEntries) && window.WaterFuelRawEntries.length >= 1);
  check(await page.evaluate(() => window.WaterFuel.getCycleLedger({ fuelEntries: window.WaterFuelRawEntries || [], reports: window.App.state.reports }).currentBalance === 828), 'cycle ledger is 1056 minus 228');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.AuthUsers?.currentUser?.()?.role === 'superAdmin' && window.App?.state?.reports?.length >= 2);
  check(true, 'Firebase Auth session restore succeeded');
  console.log('BROWSER_STEP=session-restored');

  console.log('BROWSER_STEP=report-detail');
  await page.evaluate(() => window.App.goReports());
  await page.waitForTimeout(100);
  await page.locator('.report-card[onclick*="current-22"]').click();
  await page.waitForSelector('#reportDetails');
  check(await page.locator('#reportDetails').isVisible(), 'report detail renders from emulator data');
  console.log('BROWSER_STEP=report-edit');
  await page.evaluate(() => window.App.openEdit('current-22'));
  await page.waitForTimeout(150);
  check(await page.evaluate(() => window.App.state.view === 'form' && window.App.state.editingId === 'current-22'), 'edit report UI opens');
  await page.evaluate(() => window.App.goHome());
  console.log('BROWSER_STEP=report-duplicate');
  await page.evaluate(() => window.App.duplicateLastReport());
  await page.waitForTimeout(150);
  check(await page.evaluate(() => window.App.state.view === 'form' && !window.App.state.editingId), 'duplicate report prepares an unsaved form');
  await page.evaluate(() => window.App.goHome());
  console.log('BROWSER_STEP=report-add');
  await page.evaluate(() => window.App.openNew());
  await page.waitForTimeout(150);
  check(await page.evaluate(() => window.App.state.view === 'form' && Boolean(document.querySelector('#formHost'))), 'add report UI opens');
  await page.evaluate(() => window.App.goHome());
  console.log('BROWSER_STEP=filters-charts-alerts');
  await page.evaluate(() => window.App.setUIFilter('alerts'));
  await page.waitForTimeout(100);
  check(await page.evaluate(() => window.App.getUIFilter() === 'alerts'), 'alert filter updates dashboard state');
  await page.evaluate(() => window.App.setDashboardDateRange('week'));
  await page.waitForTimeout(100);
  check(await page.evaluate(() => window.App.state.dashboardDateRange === 'week'), 'date filter updates dashboard state');
  await page.evaluate(() => window.App.setUIFilter('all'));
  await page.evaluate(() => window.App.setDashboardDateRange('all'));
  await page.waitForTimeout(100);
  check(await page.evaluate(() => Boolean(document.querySelector('#productionRejectChart')) && Boolean(document.querySelector('#fuelConsumptionChart')) && Boolean(window.prodChartInstance) && Boolean(window.fuelChartInstance)), 'dashboard charts initialize');
  await page.evaluate(() => window.App.openExplainModal());
  check(await page.locator('#explainModal').isVisible(), 'alert explanation opens');
  await page.evaluate(() => document.querySelector('#explainModal')?.remove());
  await page.evaluate(() => window.WaterFuel.openFuelModal());
  check(await page.locator('#fuelEntryModal').isVisible(), 'add fuel UI opens');
  await page.evaluate(() => window.WaterFuel.closeFuelModal());
  console.log('BROWSER_STEP=theme-mobile');
  await page.evaluate(() => window.App.toggleTheme());
  check(await page.evaluate(() => ['dark', 'light'].includes(document.documentElement.dataset.theme)), 'theme toggle remains functional');

  for (const [method, marker] of [
    ['goReports', 'التقارير'], ['goFuel', 'الوقود'], ['goExport', 'تصدير'], ['openSettings', 'الإعدادات']
  ]) {
    console.log(`BROWSER_STEP=navigate-${method}`);
    await page.evaluate(name => window.App[name](), method);
    await page.waitForTimeout(150);
    check((await page.locator('body').innerText()).includes(marker), `${method} navigation rendered`);
  }
  await page.evaluate(() => window.UsersUI.open());
  await page.waitForTimeout(150);
  check((await page.locator('body').innerText()).includes('Firebase Admin'), 'users view exposes trusted-management boundary');

  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => window.App.goHome());
    await page.waitForTimeout(150);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${width}px layout has no horizontal overflow`);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.App.goExport());
  await page.waitForTimeout(100);
  console.log('BROWSER_STEP=export-ready');
  const excelDownload = page.waitForEvent('download', { timeout: 5000 });
  await page.evaluate(() => window.App.exportFilteredExcel());
  await (await excelDownload).cancel();
  check(true, 'Excel export generated a download');
  console.log('BROWSER_STEP=excel-exported');
  const wordDownload = page.waitForEvent('download', { timeout: 5000 });
  await page.evaluate(() => window.App.exportFilteredWord());
  await (await wordDownload).cancel();
  check(true, 'Word export generated a download');
  console.log('BROWSER_STEP=word-exported');
  console.log('BROWSER_STEP=pdf-export');
  await page.evaluate(() => {
    window.__waterPdf = '';
    window.open = () => ({ document: { write(html) { window.__waterPdf = html; }, close() {} } });
  });
  await page.evaluate(() => window.App.exportFilteredPDF());
  check(await page.evaluate(() => window.__waterPdf.includes('<title>تقارير مخصصة</title>') && window.__waterPdf.includes('window.print()')), 'PDF export generated a print document');
  await page.evaluate(() => { window.__waterWhatsApp = ''; window.open = url => { window.__waterWhatsApp = url; return { document: { write() {}, close() {} } }; }; });
  await page.evaluate(() => window.App.exportFilteredWhatsApp());
  check(await page.evaluate(() => window.__waterWhatsApp.startsWith('https://wa.me/?text=')), 'WhatsApp export generated text URL');
  console.log('BROWSER_STEP=whatsapp-exported');
  await page.evaluate(() => window.FirebaseService.signOut());
  await page.waitForSelector('#loginUsername');
  check(true, 'logout returned to login');
  console.log('BROWSER_STEP=logged-out');
  await page.fill('#loginUsername', 'disabled@example.test');
  await page.fill('#loginPassword', 'Safe-Emulator-Only-1!');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(300);
  check(await page.locator('#loginUsername').isVisible(), 'disabled account remains unauthenticated');
  console.log('BROWSER_STEP=disabled-denied');
  for (const [email, role] of [
    ['supervisor@example.test', 'supervisor'], ['dataentry@example.test', 'dataEntry'], ['viewer@example.test', 'viewer']
  ]) {
    const roleContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await roleContext.addInitScript(() => {
      window.WATER_APP_FIREBASE_CONFIG = { apiKey: 'emulator-only-key', authDomain: 'waterdash-emulator.firebaseapp.com', projectId: 'waterdash-emulator', appId: 'emulator-only-app' };
      window.WATER_APP_EMULATOR = { enabled: true, host: '127.0.0.1', authPort: 9099, firestorePort: 8080 };
    });
    const rolePage = await roleContext.newPage();
    rolePage.on('pageerror', error => errors.push(error.message));
    rolePage.on('console', message => {
      if (message.type() !== 'error') return;
      const location = message.location();
      const expectedInvalidLogin = location.url.startsWith('http://127.0.0.1:9099/') && message.text().includes('Failed to load resource');
      if (!expectedInvalidLogin) errors.push(message.text());
    });
    rolePage.on('request', request => requests.push(request.url()));
    await rolePage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await rolePage.fill('#loginUsername', email);
    await rolePage.fill('#loginPassword', 'Safe-Emulator-Only-1!');
    await rolePage.locator('button[type="submit"]').click();
    await rolePage.waitForFunction(expectedRole => window.AuthUsers?.currentUser?.()?.role === expectedRole && window.App?.state?.reports?.length >= 2, role);
    check(true, `${role} native Firebase Auth login succeeded`);
    console.log(`BROWSER_STEP=${role}-authenticated`);
    await roleContext.close();
  }

  const productionRequests = requests.filter(requestUrl => {
    const url = new URL(requestUrl);
    return /fridge-oracle-sza|firestore\.googleapis\.com|identitytoolkit\.googleapis\.com/i.test(url.hostname);
  });
  check(productionRequests.length === 0, `no production Firebase requests: ${productionRequests.join(', ')}`);
  check(errors.length === 0, `browser console/page errors: ${errors.join(' | ')}`);
  await browser.close();
  console.log(`BROWSER_TESTS_PASSED=${passed}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
