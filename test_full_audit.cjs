const fs = require('fs');
const path = require('path');

// Test framework helpers
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
  classList: { add: () => {}, remove: () => {}, toggle: () => {} },
  setAttribute: () => {},
  removeAttribute: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  dispatchEvent: () => {},
  style: {},
  appendChild: () => {},
  remove: () => {}
});

// Mock environment for browser scripts
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
  WATER_APP_BUILD: '20260823-stabilization-v1',
  addEventListener: () => {}
};
global.document = {
  documentElement: { dataset: {} },
  body: makeEl(),
  addEventListener: () => {},
  getElementById: () => null,
  createElement: () => makeEl(),
  querySelector: () => null,
  querySelectorAll: () => []
};
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.navigator = { userAgent: 'node' };
global.MutationObserver = class { observe() {} };
global.requestAnimationFrame = fn => fn();
global.firebase = {
  apps: [],
  initializeApp: () => ({}),
  auth: () => ({ onAuthStateChanged: () => () => {}, currentUser: null }),
  firestore: () => ({ collection: () => ({ doc: () => ({ set: async () => {}, get: async () => ({ exists: false }) }) }) })
};
global.firebase.firestore.FieldValue = { serverTimestamp: () => new Date(), delete: () => null };

// Load modules
function loadModule(relPath) {
  const code = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
  const fn = new Function('global', 'window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'MutationObserver', 'firebase', 'requestAnimationFrame', code);
  fn(global, global.window, global.document, global.localStorage, global.sessionStorage, global.navigator, global.MutationObserver, global.firebase, global.requestAnimationFrame);
}

console.log("=========================================");
console.log("WATERDASH FULL SYSTEM AUDIT TEST SUITE");
console.log("=========================================");

loadModule('assets/core-system.js');
loadModule('assets/auth-system.js');
loadModule('assets/reports-system.js');
loadModule('assets/fuel-system.js');
loadModule('assets/export-system.js');
loadModule('assets/main-app.js');

// 1. Numeric Normalization & Arabic Digits Tests
console.log("\n--- 1. Numeric Normalization & Arabic Digits ---");
assertEqual(window.ReportUtils.number('١٢٣.٤٥'), 123.45, "Parses Eastern Arabic numerals");
assertEqual(window.ReportUtils.number('2,847.60'), 2847.6, "Parses comma as decimal or thousands separator");
assertEqual(window.ReportUtils.number(null), 0, "Handles null safely");
assertEqual(window.ReportUtils.number(''), 0, "Handles empty string safely");

// 2. Date & Time Normalization Tests
console.log("\n--- 2. Date & Time Normalization ---");
assertEqual(window.ReportUtils.normalizeDateInput('2026-05-18'), '2026-05-18', "Standard ISO date preserved");
assertEqual(window.ReportUtils.normalizeDateInput('18/05/2026'), '2026-05-18', "DD/MM/YYYY converted to ISO");
assertEqual(window.ReportUtils.normalizeDateInput('١٨/٠٥/٢٠٢٦'), '2026-05-18', "Arabic digits in date normalized");
assertEqual(window.ReportUtils.normalizeTimeInput('08:30 ص'), '08:30', "Arabic AM time converted to 24h");
assertEqual(window.ReportUtils.normalizeTimeInput('02:15 م'), '14:15', "Arabic PM time converted to 24h");
assertEqual(window.ReportUtils.normalizeTimeInput('12:00 م'), '12:00', "12:00 PM is 12:00");
assertEqual(window.ReportUtils.normalizeTimeInput('12:00 ص'), '00:00', "12:00 AM is 00:00");

// 3. Generator Run Hours Calculation
console.log("\n--- 3. Generator Run Hours Calculation ---");
assertEqual(window.ReportUtils.calcRunHours('08:00', '16:30'), '8:30', "Normal daytime shift");
assertEqual(window.ReportUtils.calcRunHours('22:00', '02:00'), '4:00', "Midnight crossing shift");
assertEqual(window.ReportUtils.calcRunHours('', '14:00'), '', "Missing start time returns empty");

// 4. Report Recalculation & Water Flow Logic
console.log("\n--- 4. Report Recalculation & Water Flow ---");
const sampleReport = {
  reportDate: '2026-05-18',
  title: 'تقرير تجريبي',
  generator: { periods: [{ startTime: '08:00', stopTime: '18:00', runHours: '' }] },
  water: { filteredRate: 33, submersibleRate: 55 },
  beneficiaries: [
    { name: 'جهة 1', quantity: 150, cars: 5 },
    { name: 'مياه خارجية / صنابير للمواطنين خارج المحطة', quantity: 50, cars: 0 }
  ]
};

const recalced = window.ReportUtils.recalc(sampleReport);
assertEqual(recalced.generator.totalRunHours, '10:00', "Total run hours calculated as 10:00");
assertEqual(recalced.water.dailyProduction, 330, "Daily production = 33 m3/h * 10h = 330");
assertEqual(recalced.water.rejectWater, 220, "Reject water = (55 - 33) * 10h = 220");
assertEqual(recalced.water.totalInputWater, 550, "Total input water = 330 + 220 = 550");
assertEqual(recalced.water.recoveryRate, 60, "Recovery rate = (330 / 550) * 100 = 60%");
assertEqual(recalced.water.filledWater, 200, "Beneficiary total filled = 150 + 50 = 200");
assertEqual(recalced.water.carsCount, 5, "Beneficiary total cars = 5 + 0 = 5");
assertEqual(recalced.water.averagePerCar, 40, "Average per car = 200 / 5 = 40");

// 5. Idempotency Test
console.log("\n--- 5. Idempotency Test ---");
const recalcedAgain = window.ReportUtils.recalc(recalced);
assertEqual(JSON.stringify(recalced), JSON.stringify(recalcedAgain), "Report recalculation is 100% idempotent");

// 6. RBAC & Permissions
console.log("\n--- 6. RBAC & Permissions ---");
assert(window.AuthUsers.ROLE_DEFINITIONS.superAdmin.permissions.deleteReports === true, "superAdmin can delete reports");
assert(window.AuthUsers.ROLE_DEFINITIONS.supervisor.permissions.deleteReports === false, "supervisor cannot delete reports");
assert(window.AuthUsers.ROLE_DEFINITIONS.supervisor.permissions.createReports === true, "supervisor can create reports");
assert(window.AuthUsers.ROLE_DEFINITIONS.dataEntry.permissions.editReports === false, "dataEntry cannot edit reports");
assert(window.AuthUsers.ROLE_DEFINITIONS.viewer.permissions.createReports === false, "viewer cannot create reports");

// 7. Summary & Totals without Floating-Point Artifacts
console.log("\n--- 7. Summary Calculations & Floating-Point Protection ---");
const reportList = [
  recalced,
  {
    ...recalced,
    reportDate: '2026-05-19',
    generator: { periods: [{ startTime: '08:00', stopTime: '13:00', runHours: '5:00' }], totalRunHours: '5:00' },
    water: { dailyProduction: 165.1, rejectWater: 110.05, filledWater: 100.1, carsCount: 2 },
    fuel: { consumedDaily: 95.2 }
  }
];
const summary = window.ReportUtils.summary(reportList);
assert(typeof summary.runHours === 'number', "Summary runHours is number");
assert(String(summary.waterProduction).indexOf('000000') === -1, "No floating point artifacts in waterProduction");
assert(String(summary.fuelConsumed).indexOf('000000') === -1, "No floating point artifacts in fuelConsumed");

console.log("\n=========================================");
console.log(`TEST SUMMARY: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
console.log("=========================================");

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
