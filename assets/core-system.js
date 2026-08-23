/* --- Auto-Generated Module: core-system.js --- */

/* ==========================================
   FILE: version-guard.js
   ========================================== */
(() => {
  const BUILD_ID = window.WATER_APP_BUILD || '20260823-prod-stable-v1';
  const BUILD_KEY = 'waterAppBuildId';
  const SAFE_CACHE_KEYS = [/cache/i, /snapshot/i, /lastHtml/i, /stale/i, /oldUi/i];

  document.documentElement.dataset.waterBuild = BUILD_ID;
  document.documentElement.dataset.waterBooting = 'true';

  function safeStorageCleanup(previousBuild) {
    if (!previousBuild || previousBuild === BUILD_ID) return;
    try {
      Object.keys(localStorage).forEach(key => {
        if (key === 'waterAppDefaultSettings') return;
        if (key === BUILD_KEY) return;
        if (SAFE_CACHE_KEYS.some(pattern => pattern.test(key))) localStorage.removeItem(key);
      });
    } catch (error) {
      console.warn('Local storage cleanup skipped', error);
    }
  }

  async function clearBrowserCaches() {
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      }
    } catch (error) {
      console.warn('Runtime cache cleanup skipped', error);
    }

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
      }
    } catch (error) {
      console.warn('Service worker cleanup skipped', error);
    }
  }

  function markBuild() {
    try {
      const previousBuild = localStorage.getItem(BUILD_KEY);
      safeStorageCleanup(previousBuild);
      localStorage.setItem(BUILD_KEY, BUILD_ID);
      localStorage.setItem('waterAppLastBootAt', new Date().toISOString());
    } catch (error) {
      console.warn('Build marker skipped', error);
    }
  }

  function forceVersionedUrl() {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('v') === BUILD_ID) return;
      if (sessionStorage.getItem(`waterAppVersionUrl:${BUILD_ID}`) === 'done') return;
      sessionStorage.setItem(`waterAppVersionUrl:${BUILD_ID}`, 'done');
      url.searchParams.set('v', BUILD_ID);
      window.location.replace(url.toString());
    } catch (error) {
      console.warn('Version URL guard skipped', error);
    }
  }

  function releaseBootLock() {
    document.documentElement.removeAttribute('data-water-booting');
    document.documentElement.dataset.waterReady = BUILD_ID;
  }

  window.WaterVersionGuard = {
    BUILD_ID,
    clearBrowserCaches,
    releaseBootLock,
    forceReload() {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('v', BUILD_ID);
        url.searchParams.set('r', String(Date.now()));
        window.location.replace(url.toString());
      } catch {
        window.location.reload();
      }
    }
  };

  markBuild();
  clearBrowserCaches();
  forceVersionedUrl();
  setTimeout(releaseBootLock, 4500);
})();


/* ==========================================
   FILE: theme-switcher.js
   ========================================== */
(() => {
  const STORAGE_KEY = 'waterAppThemeMode';
  const LEGACY_KEY = 'waterAppTheme';
  const allowed = ['dark', 'light'];

  function cleanThemeClasses() {
    document.body.classList.remove(
      'theme-ocean', 'theme-midnight', 'theme-copper', 'theme-graphite',
      'theme-emerald', 'theme-sand', 'theme-iceblue', 'theme-dark', 'theme-light'
    );
  }

  function ensureModeSwitcher() {
    if (!document.body) return null;
    let dock = document.getElementById('modeSwitcher');
    if (!dock) {
      dock = document.createElement('div');
      dock.id = 'modeSwitcher';
      dock.className = 'theme-switch-shell';
      dock.innerHTML = `
        <button
          id="themeToggle"
          class="theme-toggle"
          type="button"
          aria-label="تبديل الوضع"
          aria-pressed="false"
          title="تبديل الوضع"
        >
          <span class="theme-toggle-led" aria-hidden="true"></span>
          <span class="theme-toggle-track" aria-hidden="true">
            <span class="theme-toggle-thumb"></span>
          </span>
        </button>
      `;
      document.body.appendChild(dock);
      dock.querySelector('#themeToggle')?.addEventListener('click', () => {
        const current = window.ThemeManager?.current?.() || 'dark';
        const next = current === 'light' ? 'dark' : 'light';
        window.ThemeManager?.saveUserTheme?.(next);
      });
    }
    return dock;
  }

  function syncSwitcher(selected) {
    const dock = ensureModeSwitcher();
    const toggle = dock?.querySelector('#themeToggle');
    if (!toggle) return;
    const isLight = selected === 'light';
    toggle.setAttribute('aria-pressed', String(isLight));
    toggle.classList.toggle('is-on', isLight);
  }

  function applyTheme(theme) {
    const selected = allowed.includes(theme) ? theme : 'dark';
    cleanThemeClasses();
    document.body.classList.add(`theme-${selected}`);
    document.documentElement.dataset.theme = selected;
    try {
      localStorage.setItem(STORAGE_KEY, selected);
      localStorage.removeItem(LEGACY_KEY);
    } catch {}
    syncSwitcher(selected);
  }

  function getInitialTheme() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('mode') || params.get('theme');
    if (allowed.includes(fromUrl)) return fromUrl;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (allowed.includes(stored)) return stored;
    } catch {}
    return 'dark';
  }

  async function saveUserTheme(theme) {
    applyTheme(theme);
    try {
      if (!window.firebase || !firebase.auth || !firebase.firestore) return;
      const user = firebase.auth().currentUser;
      if (!user) return;
      await firebase.firestore().collection('userPreferences').doc(user.uid).set({
        themeMode: theme,
        theme: theme,
        userName: window.WATER_APP_SETTINGS?.defaultUserName || 'صالح الدحنون',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.warn('Theme mode preference was saved locally only.', error);
    }
  }

  async function loadUserTheme(user) {
    try {
      if (!user || !window.firebase || !firebase.firestore) return;
      const snap = await firebase.firestore().collection('userPreferences').doc(user.uid).get();
      const data = snap.exists ? snap.data() : {};
      const saved = data?.themeMode || data?.theme;
      if (allowed.includes(saved)) applyTheme(saved);
    } catch (error) {
      console.warn('Could not load remote theme mode preference.', error);
    }
  }

  window.ThemeManager = {
    allowed,
    applyTheme,
    saveUserTheme,
    loadUserTheme,
    current: () => document.documentElement.dataset.theme || 'dark'
  };

  if (document.body) applyTheme(getInitialTheme());
  else window.addEventListener('DOMContentLoaded', () => applyTheme(getInitialTheme()));
})();


/* ==========================================
   FILE: firebase-config.js
   ========================================== */
window.WATER_APP_FIREBASE_CONFIG = window.WATER_APP_FIREBASE_CONFIG || {
  apiKey: "AIzaSyDSutT8QUKJDV756T3dzYD915BDS4k2Iw8",
  authDomain: "fridge-oracle-sza.firebaseapp.com",
  projectId: "fridge-oracle-sza",
  storageBucket: "fridge-oracle-sza.firebasestorage.app",
  messagingSenderId: "943671816209",
  appId: "1:943671816209:web:56422aa9e09bf75f2281b0"
};

window.WATER_APP_SETTINGS = {
  appName: 'نظام تقارير تشغيل وضخ المياه',
  defaultUserName: 'صالح الدحنون',
  defaultRole: 'سوبر أدمن',
  defaultStationName: 'المحطة الرئيسية',
  defaultWellName: 'بئر واحد'
};


/* ==========================================
   FILE: firebase-service.js
   ========================================== */
window.FirebaseService = (() => {
  const cfg = window.WATER_APP_FIREBASE_CONFIG || {};
  const isConfigured = Boolean(cfg.apiKey && !String(cfg.apiKey).includes('PUT_YOUR'));
  let app = null;
  let auth = null;
  let db = null;
  let emulatorConfigured = false;

  function isLoopbackHost(host) {
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  }

  function configureEmulators() {
    const emulator = window.WATER_APP_EMULATOR;
    if (!emulator?.enabled || emulatorConfigured) return;
    const host = String(emulator.host || '127.0.0.1');
    const pageHost = window.location?.hostname || '';
    if (!isLoopbackHost(host) || !isLoopbackHost(pageHost)) {
      throw new Error('رفض وضع المحاكي: يجب أن تكون الصفحة والخدمات على loopback فقط.');
    }
    const authPort = Number(emulator.authPort || 9099);
    const firestorePort = Number(emulator.firestorePort || 8080);
    if (!Number.isInteger(authPort) || !Number.isInteger(firestorePort)) {
      throw new Error('رفض وضع المحاكي: منافذ المحاكي غير صالحة.');
    }
    auth.useEmulator(`http://${host}:${authPort}`, { disableWarnings: true });
    db.useEmulator(host, firestorePort);
    emulatorConfigured = true;
    window.WATER_APP_RUNTIME = Object.freeze({ mode: 'emulator', host, authPort, firestorePort });
    console.info('WaterDash Firebase Emulator active', window.WATER_APP_RUNTIME);
  }

  function init() {
    if (!isConfigured) return { configured: false };
    if (!firebase.apps.length) app = firebase.initializeApp(cfg);
    else app = firebase.app();
    auth = firebase.auth();
    db = firebase.firestore();
    configureEmulators();
    return { configured: true, app, auth, db };
  }

  function now() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function collection(name) {
    if (!db) init();
    return db.collection(name);
  }

  async function signIn(email, password) {
    init();
    if (window.AuthUsers?.signIn) return window.AuthUsers.signIn(email, password);
    const normalizedEmail = String(email || '').trim();
    if (!normalizedEmail.includes('@')) throw new Error('أدخل بريدًا إلكترونيًا صالحًا.');
    return auth.signInWithEmailAndPassword(normalizedEmail, String(password || ''));
  }

  async function signOut() {
    if (!auth) init();
    window.AuthUsers?.clearCurrentUser?.();
    return auth.signOut();
  }

  function onAuth(callback) {
    init();
    return auth.onAuthStateChanged(async user => {
      await window.AuthUsers?.syncFirebaseUser?.(user);
      return callback(user);
    });
  }

  function listenReports(callback) {
    init();
    return collection('reports').orderBy('reportDate', 'desc').onSnapshot(snapshot => {
      const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(reports);
    });
  }

  async function saveReport(report, user, existingId) {
    init();
    // Apply recalc (includes date normalization) if available — integrated from date-save-patch
    const normalized = (window.ReportUtils?.recalc) ? window.ReportUtils.recalc(report) : report;
    if (normalized?.reportDate && window.ReportUtils?.normalizeDateInput) {
      normalized.reportDate = window.ReportUtils.normalizeDateInput(normalized.reportDate);
    }
    const payload = {
      ...normalized,
      updatedAt: now(),
      updatedBy: window.WATER_APP_SETTINGS.defaultUserName
    };
    let ref;
    if (existingId) {
      ref = collection('reports').doc(existingId);
      await ref.set(payload, { merge: true });
      await logActivity('update', user, existingId, { title: report.title });
    } else {
      ref = await collection('reports').add({
        ...payload,
        createdAt: now(),
        createdBy: window.WATER_APP_SETTINGS.defaultUserName
      });
      await logActivity('create', user, ref.id, { title: report.title });
    }
    return ref.id;
  }

  async function deleteReport(id, user) {
    init();
    await collection('reports').doc(id).delete();
    await logActivity('delete', user, id, {});
  }

  async function logActivity(actionType, user, reportId, changedFields) {
    init();
    return collection('activityLogs').add({
      actionType,
      userName: window.WATER_APP_SETTINGS.defaultUserName,
      userRole: window.WATER_APP_SETTINGS.defaultRole,
      authUid: user?.uid || null,
      reportId,
      changedFields: changedFields || {},
      timestamp: now()
    });
  }

  async function seedSettings() {
    init();
    if (window.WATER_APP_BOOTSTRAP_SETTINGS !== true) {
      throw new Error('تهيئة الإعدادات تتطلب تفعيلًا صريحًا في بيئة آمنة.');
    }
    await collection('settings').doc('main').set({
      appName: window.WATER_APP_SETTINGS.appName,
      defaultStationName: window.WATER_APP_SETTINGS.defaultStationName,
      updatedAt: now()
    }, { merge: true });
    await collection('stations').doc('main-station').set({
      name: window.WATER_APP_SETTINGS.defaultStationName,
      wells: [{ id: 'well-1', name: window.WATER_APP_SETTINGS.defaultWellName }],
      active: true,
      updatedAt: now()
    }, { merge: true });
  }

  init();

  return { isConfigured, init, signIn, signOut, onAuth, listenReports, saveReport, deleteReport, logActivity, seedSettings };
})();


/* ==========================================
   FILE: parser.js
   ========================================== */
window.ReportParser = (() => {
  const digitMap = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9' };
  const normalize = value => String(value || '').replace(/[٠-٩۰-۹]/g, d => digitMap[d] || d).replace(/\r/g, '').trim();
  const number = value => {
    const n = Number(normalize(value).replace(/[^0-9.,-]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  const first = (text, patterns) => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return String(match[1] || '').trim();
    }
    return '';
  };

  function inputDate(text) {
    const match = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (!match) return new Date().toISOString().slice(0, 10);
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }

  function displayDate(date) {
    const parts = String(date || '').split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;
  }

  function parseTime(line) {
    const value = normalize(line);
    const match = value.match(/(\d{1,2})\s*[:：]\s*(\d{1,2})/);
    if (!match) return '';
    let hour = Number(match[1]);
    const minute = String(match[2]).padStart(2, '0');
    if (/مساء|pm/i.test(value) && hour < 12) hour += 12;
    if (/صباح|am/i.test(value) && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${minute}`;
  }

  function duration(start, end) {
    if (!start || !end) return '';
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let s = sh * 60 + sm;
    let e = eh * 60 + em;
    if (e < s) e += 1440;
    const diff = e - s;
    return `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, '0')}`;
  }

  function cleanName(line) {
    return String(line || '').replace(/^[\s▪▫◾◼︎\-*\.]+/g, '').replace(/\s+/g, ' ').trim();
  }

  function extractQuantity(line) {
    return number(first(line, [/(?:الكمية\s*\/?|كمية\s*\/?)\s*([0-9.,]+)/i]));
  }

  function extractCars(line) {
    return number(first(line, [/(?:عدد\s+السيارات|السيارات)\s*\/?\s*[:：]?\s*([0-9.,]+)/i]));
  }

  function beneficiaries(text) {
    const start = text.search(/الإنتاج اليومي|الانتاج اليومي|جهات|التعبئة/i);
    const section = start >= 0 ? text.slice(start) : text;
    const lines = section.split('\n').map(x => x.trim()).filter(Boolean);
    const items = [];
    let name = '';

    for (const line of lines) {
      if (/إجمالي|اجمالي|تقرير|ساعة|ساعات|وقود|فحوصات|كميات/.test(line)) continue;

      const hasQty = /(?:الكمية\s*\/?|كمية\s*\/?)\s*[0-9.,]+/i.test(line);
      if (hasQty) {
        const inlineName = cleanName(line.replace(/(?:الكمية\s*\/?|كمية\s*\/?).*$/i, ''));
        const finalName = name || inlineName;
        if (finalName) {
          items.push({ name: finalName, quantity: extractQuantity(line), cars: extractCars(line) });
          name = '';
        }
        continue;
      }

      const external = line.match(/(?:مياه خارجية|صنابير|خارج المحطة).*?([0-9.,]+)\s*كوب/i);
      if (external) {
        items.push({ name: 'مياه خارجية / صنابير للمواطنين خارج المحطة', quantity: number(external[1]), cars: 0 });
        name = '';
        continue;
      }

      const isArabicName = /[\u0600-\u06FF]/.test(line) && !/:/.test(line) && !/PH|TDS|الكلور|الحامضيه/i.test(line);
      if (isArabicName) name = cleanName(line);
    }
    return items.filter(item => item.name && item.quantity >= 0);
  }

  function parse(raw) {
    const text = normalize(raw);
    if (!text) throw new Error('الصق نص التقرير أولًا.');

    const lines = text.split('\n').map(x => x.trim()).filter(Boolean);
    const date = inputDate(text);
    const startLine = lines.find(x => /تشغيل المولد|ساعة تشغيل/i.test(x)) || '';
    const endLine = lines.find(x => /الإيقاف|الايقاف|إيقاف|ايقاف/i.test(x)) || '';
    const start = parseTime(startLine);
    const end = parseTime(endLine);
    const manualDuration = first(text, [/ساعات التشغيل\s*[:：]?\s*([0-9]{1,2}\s*[:：]\s*[0-9]{1,2})/i]);
    const runHours = manualDuration.replace(/\s/g, '').replace('：', ':') || duration(start, end);
    const list = beneficiaries(text);
    const totalQuantity = list.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalCars = list.reduce((sum, item) => sum + Number(item.cars || 0), 0);
    const statedQuantity = number(first(text, [/إجمالي كمية المياه المعبأة\s*[:：]?\s*([0-9.,]+)/, /اجمالي كمية المياه المعبأة\s*[:：]?\s*([0-9.,]+)/]));
    const statedCars = number(first(text, [/إجمالي عدد السيارات\s*[:：]?\s*([0-9.,]+)/, /اجمالي عدد السيارات\s*[:：]?\s*([0-9.,]+)/]));
    const warnings = [];

    if (statedQuantity && statedQuantity !== totalQuantity) warnings.push(`إجمالي المياه المكتوب ${statedQuantity} كوب، بينما المحسوب ${totalQuantity} كوب.`);
    if (statedCars && statedCars !== totalCars) warnings.push(`إجمالي السيارات المكتوب ${statedCars} سيارة، بينما المحسوب ${totalCars} سيارة.`);
    if (!start) warnings.push('لم يتم التعرف على وقت تشغيل المولد.');
    if (!end) warnings.push('لم يتم التعرف على وقت الإيقاف.');
    if (!list.length) warnings.push('لم يتم التعرف على الجهات المستفيدة.');

    return {
      date,
      title: `تقرير تشغيل وضخ المياه ${displayDate(date)}`,
      generatorStart: start,
      generatorEnd: end,
      runHours,
      fuelAdded: number(first(text, [/الوقود\s+المضاف\s+يومياً[^0-9\n]*([0-9.,]+)/, /المضاف\s+يومياً[^0-9\n]*([0-9.,]+)/])),
      fuelConsumed: number(first(text, [/الوقود\s+المستهلك\s+يومياً\s*([0-9.,]+)/, /المستهلك\s+يومياً\s*([0-9.,]+)/])),
      fuelMunicipal: number(first(text, [/المورد\s+من\s+البلدية[^0-9\n]*([0-9.,]+)/])),
      fuelBalance: number(first(text, [/المتبقي[^0-9\n]*([0-9.,]+)/])),
      submersibleRate: number(first(text, [/(?:انتاج|إنتاج)\s+الغاطس\s*[:：]?\s*([0-9.,]+)/])),
      filteredRate: number(first(text, [/بعد\s+الفلترة\s*[:：]?\s*([0-9.,]+)/])),
      wasteQuantity: number(first(text, [/العادم\s*[:：]?\s*([0-9.,]+)/])),
      phFiltered: number(first(text, [/بعد\s+التحلية[^\n]*?Ph\s*[:：]?\s*([0-9.,]+)/i, /بعد\s+التحلية[^\n]*?([0-9.,]+)\s*$/im])),
      phWell: number(first(text, [/لمياه\s+الغاطس[^\n]*?Ph\s*[:：]?\s*([0-9.,]+)/i, /مياه\s+الغاطس[^\n]*?Ph\s*[:：]?\s*([0-9.,]+)/i])),
      tdsFiltered: number(first(text, [/مياه\s+محلاه\)?\s*([0-9.,]+)\s*[:：]?\s*TDS/i])),
      tdsWell: number(first(text, [/بئر\s+مياه\)?\s*([0-9.,]+)\s*[:：]?\s*TDS/i])),
      tdsWaste: number(first(text, [/عادم\)?\s*([0-9.,]+)\s*[:：]?\s*TDS/i])),
      chlorine: number(first(text, [/الكلور\s+الحر\s*[:：]?\s*([0-9.,]+)/])),
      beneficiaries: list,
      totalQuantity,
      totalCars,
      statedQuantity,
      statedCars,
      warnings,
      sourceText: text,
      createdAt: new Date().toISOString()
    };
  }

  return { parse, displayDate };
})();


