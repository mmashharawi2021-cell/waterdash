const fs = require('fs');
const path = require('path');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName}`);
  }
}

function assertEqual(actual, expected, testName) {
  totalTests++;
  if (actual === expected) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName} | Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`);
  }
}

const makeEl = () => ({
  classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
  setAttribute: () => {},
  removeAttribute: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  dispatchEvent: () => {},
  style: {},
  appendChild: () => {},
  insertAdjacentHTML: () => {},
  insertAdjacentElement: () => {},
  remove: () => {}
});

global.window = {
  location: { href: 'http://localhost:5173/', search: '', replace: () => {} },
  WATER_APP_SETTINGS: {
    appName: 'نظام تقارير تشغيل وضخ المياه',
    defaultUserName: 'صالح الدحنون',
    defaultRole: 'سوبر أدمن',
    defaultStationName: 'المحطة الرئيسية',
    defaultWellName: 'بئر واحد',
    lossPercentage: '32.74',
    fuelRate: '19'
  },
  WATER_APP_BUILD: '20260823-prod-stable-v1',
  addEventListener: () => {}
};
global.document = {
  documentElement: { dataset: {}, getAttribute: () => null, removeAttribute: () => {} },
  body: makeEl(),
  addEventListener: () => {},
  getElementById: () => null,
  createElement: () => makeEl(),
  querySelector: () => null,
  querySelectorAll: () => []
};
global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; }
};
global.sessionStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; }
};
global.navigator = { userAgent: 'node' };
global.MutationObserver = class { observe() {} };
global.requestAnimationFrame = fn => fn();
global.firebase = {
  apps: [],
  initializeApp: () => ({}),
  app: () => ({}),
  auth: () => ({ onAuthStateChanged: () => () => {}, currentUser: null, signInAnonymously: async () => {}, signOut: async () => {} }),
  firestore: () => ({
    collection: () => ({
      doc: () => ({ set: async () => {}, get: async () => ({ exists: false }), delete: async () => {} }),
      orderBy: () => ({ onSnapshot: () => () => {}, get: async () => ({ docs: [] }) }),
      where: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) }),
      add: async () => ({ id: 'new-id' })
    }),
    batch: () => ({ delete: () => {}, commit: async () => {} })
  })
};
global.firebase.firestore.FieldValue = { serverTimestamp: () => new Date(), delete: () => null };
global.XLSX = {
  utils: { book_new: () => ({}), book_append_sheet: () => {}, json_to_sheet: () => ({}) },
  writeFile: () => {}
};

function loadModule(relPath) {
  const code = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
  const fn = new Function('global', 'window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'MutationObserver', 'firebase', 'requestAnimationFrame', 'XLSX', code);
  fn(global, global.window, global.document, global.localStorage, global.sessionStorage, global.navigator, global.MutationObserver, global.firebase, global.requestAnimationFrame, global.XLSX);
}

console.log("=========================================");
console.log("WATERDASH EXTENDED PRE-MERGE INTEGRATION SUITE");
console.log("=========================================");

loadModule('assets/core-system.js');
loadModule('assets/auth-system.js');
loadModule('assets/reports-system.js');
loadModule('assets/fuel-system.js');
loadModule('assets/export-system.js');
loadModule('assets/main-app.js');

// 1. Critical Fuel Integration Scenario (Section 22 & 23)
console.log("\n--- 1. Critical Fuel Accounting: 1056L Incoming -> 228L Consumed -> 828L Balance ---");
const initialEntries = [
  { id: 'fuel-1', type: 'incoming', date: '2026-08-20', time: '09:00', quantityLiters: 1056, supplier: 'بلدية بيت لاهيا' }
];
window.WaterFuelRawEntries = initialEntries;

const report1 = window.ReportUtils.recalc({
  id: 'rep-1',
  reportDate: '2026-08-20',
  title: 'تقرير تشغيل 20/08/2026',
  generator: { periods: [{ startTime: '08:00', stopTime: '20:00', runHours: '12:00' }], totalRunHours: '12:00' },
  fuel: { consumedDaily: 228, previousBalance: 1056, currentBalance: 828 },
  water: { filteredRate: 33, submersibleRate: 55, dailyProduction: 396, rejectWater: 264 }
});

assertEqual(window.ReportUtils.number(report1.fuel.previousBalance), 1056, "Report 1 previousBalance is 1056");
assertEqual(window.ReportUtils.number(report1.fuel.consumedDaily), 228, "Report 1 consumedDaily is 228");
assertEqual(window.ReportUtils.number(report1.fuel.currentBalance), 828, "Report 1 currentBalance is 828");

const summary1 = window.ReportUtils.summary([report1]);
assertEqual(summary1.fuelConsumed, 228, "Summary consumed fuel is 228");

// 2. Second Report Scenario (Section 24)
console.log("\n--- 2. Second Report Scenario Starting From 828L Balance ---");
const report2 = window.ReportUtils.recalc({
  id: 'rep-2',
  reportDate: '2026-08-21',
  title: 'تقرير تشغيل 21/08/2026',
  generator: { periods: [{ startTime: '08:00', stopTime: '18:00', runHours: '10:00' }], totalRunHours: '10:00' },
  fuel: { consumedDaily: 190, previousBalance: 828, currentBalance: 638 },
  water: { filteredRate: 33, submersibleRate: 55, dailyProduction: 330, rejectWater: 220 }
});

assertEqual(window.ReportUtils.number(report2.fuel.previousBalance), 828, "Report 2 correctly starts from previous currentBalance 828");
assertEqual(window.ReportUtils.number(report2.fuel.currentBalance), 638, "Report 2 ends with 828 - 190 = 638");

const summary2 = window.ReportUtils.summary([report1, report2]);
assertEqual(summary2.fuelConsumed, 418, "Combined consumption = 228 + 190 = 418");

// 3. New Fuel After Report (Section 25)
console.log("\n--- 3. New Fuel Shipment Added After Reports ---");
const updatedEntries = [
  ...initialEntries,
  { id: 'fuel-2', type: 'incoming', date: '2026-08-22', time: '10:00', quantityLiters: 500, supplier: 'بلدية بيت لاهيا' }
];
const totalIncoming = updatedEntries.filter(x => x.type !== 'consumed').reduce((s, x) => s + window.ReportUtils.number(x.quantityLiters), 0);
assertEqual(totalIncoming, 1556, "Total incoming fuel is 1056 + 500 = 1556");
const totalConsumed = summary2.fuelConsumed;
assertEqual(totalIncoming - totalConsumed, 1138, "Net stock after new shipment = 1556 - 418 = 1138");

// 4. Duplicate Report Scenario (Section 27)
console.log("\n--- 4. Duplicate Report Recalculation ---");
const duplicatedReport = window.ReportUtils.recalc({
  ...report2,
  id: '',
  reportDate: '2026-08-23',
  title: 'تقرير تشغيل 23/08/2026',
  generator: { periods: [{ startTime: '09:00', stopTime: '17:00', runHours: '8:00' }], totalRunHours: '8:00' },
  fuel: { consumedDaily: '', previousBalance: '', currentBalance: '' },
  water: { filteredRate: 33, submersibleRate: 55, dailyProduction: '', rejectWater: '' }
});
assertEqual(window.ReportUtils.number(duplicatedReport.fuel.consumedDaily), 152, "Duplicated report re-computes daily fuel from generator hours (8h * 19 = 152)");
assertEqual(duplicatedReport.water.dailyProduction, 264, "Duplicated report calculates water production for 8h (8h * 33 = 264)");

// 5. WhatsApp Text Formatting (Section 35)
console.log("\n--- 5. WhatsApp Text Generation & Consistency ---");
const waText = window.ReportUtils.whatsappText(report1);
assert(waText.includes('تقرير تشغيل 20/08/2026'), "WhatsApp text contains title");
assert(waText.includes('228'), "WhatsApp text contains consumed fuel 228");
assert(waText.includes('828'), "WhatsApp text contains current balance 828");
assert(waText.includes('396'), "WhatsApp text contains daily production 396");

// 6. Beneficiaries & External Water Normalization
console.log("\n--- 6. External Water & Beneficiary Aggregation ---");
const extReport = window.ReportUtils.recalc({
  reportDate: '2026-08-20',
  water: { filteredRate: 33, submersibleRate: 55 },
  beneficiaries: [
    { name: 'بلدية بيت لاهيا', quantity: 200, cars: 8 },
    { name: 'مياه خارجية / صنابير للمواطنين خارج المحطة', quantity: 80, cars: 999 } // cars should be forced to 0
  ]
});
assertEqual(extReport.beneficiaries[1].cars, 0, "External water cars forced to 0");
assertEqual(extReport.water.filledWater, 280, "Total filled water = 200 + 80 = 280");
assertEqual(extReport.water.carsCount, 8, "Total cars count = 8 + 0 = 8");
assertEqual(extReport.water.averagePerCar, 35, "Average per car = 280 / 8 = 35");

// 7. Numeric Precision & Edge Cases (Section 18)
console.log("\n--- 7. Floating Point Precision & Digit Variants ---");
assertEqual(window.ReportUtils.number('٢٨٤٧٫٦'), 2847.6, "Parses Persian/Arabic comma and digits");
assertEqual(window.ReportUtils.number('2,847.60'), 2847.6, "Parses standard Western comma separator");
assertEqual(window.ReportUtils.round(0.1 + 0.2, 2), 0.3, "0.1 + 0.2 rounded safely to 0.3");
assertEqual(window.ReportUtils.round(22373.769999999993, 2), 22373.77, "Cleans floating point epsilon noise");

// 8. Historical Data Compatibility (Section 13)
console.log("\n--- 8. Historical Data Compatibility ---");
const legacyDoc = {
  title: 'تقرير قديم',
  reportDate: '2025-01-10',
  waterNotes: 'ملاحظة'
};
const legacyRecalced = window.ReportUtils.recalc(legacyDoc);
assert(legacyRecalced !== null, "Legacy report recalc succeeds without crashing");
assertEqual(legacyRecalced.water.dailyProduction, '', "Missing fields default to empty string safely");

// 9. RBAC Permission Guards (Section 37)
console.log("\n--- 9. RBAC Permission Checks ---");
assert(window.AuthUsers.ROLE_DEFINITIONS.superAdmin.permissions.manageUsers === true, "superAdmin can manage users");
assert(window.AuthUsers.ROLE_DEFINITIONS.supervisor.permissions.manageUsers === false, "supervisor cannot manage users");
assert(window.AuthUsers.ROLE_DEFINITIONS.viewer.permissions.createReports === false, "viewer cannot create reports");
assert(window.AuthUsers.ROLE_DEFINITIONS.viewer.permissions.exportPdf === true, "viewer can export PDF");

console.log("\n=========================================");
console.log(`EXTENDED TEST SUMMARY: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
console.log("=========================================");

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
