const fs = require('fs');
const path = require('path');

const makeEl = () => ({
  classList: { add: () => {}, remove: () => {} },
  appendChild: () => {},
  addEventListener: () => {},
  remove: () => {},
  setAttribute: () => {},
  removeAttribute: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
  style: {}
});

global.window = { addEventListener: () => {}, WATER_APP_SETTINGS: { fuelRate: 19 } };
global.document = {
  addEventListener: () => {},
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: makeEl,
  body: makeEl()
};

const fuelCode = fs.readFileSync(path.join(__dirname, 'assets/fuel-system.js'), 'utf8');
eval(fuelCode.replace('init();', ''));

let passed = 0;
let failed = 0;
function equal(name, actual, expected) {
  if (actual === expected) {
    passed++;
    console.log(`[PASS] ${name}`);
  } else {
    failed++;
    console.error(`[FAIL] ${name}: expected ${expected}, received ${actual}`);
  }
}

const fixtures = {
  fuelEntries: [
    { id: 'before', type: 'incoming', date: '2026-08-21', quantityLiters: 20370 },
    { id: 'on-boundary', type: 'incoming', date: '2026-08-22', quantityLiters: 1056 },
    { id: 'after', type: 'incoming', date: '2026-08-23', quantityLiters: 44 },
    { id: 'manual-historical', type: 'consumed', date: '2026-08-23', quantityLiters: 30 }
  ],
  reports: [
    { id: 'before-report', reportDate: '2026-08-21', fuel: { consumedDaily: 9999 } },
    { id: 'cycle-report', reportDate: '2026-08-22', fuel: { consumedDaily: 228 } }
  ],
  cycleStart: '2026-08-22'
};

const ledger = window.WaterFuel.getCycleLedger(fixtures);
equal('Boundary is inclusive', ledger.incomingFuel, 1100);
equal('Pre-reset incoming does not leak', ledger.entriesUsed.some(entry => entry.id === 'before'), false);
equal('Pre-reset report does not leak', ledger.reportsUsed.some(report => report.id === 'before-report'), false);
equal('Report consumption is counted once', ledger.reportConsumption, 228);
equal('Manual historical consumption is excluded under report-only policy', ledger.manualConsumption, 0);
equal('Excluded manual consumption remains visible to the ledger', ledger.ignoredManualConsumption, 30);
equal('Cycle balance is incoming minus report consumption', ledger.currentBalance, 872);

const known = window.WaterFuel.getCycleLedger({
  cycleStart: '2026-08-22',
  fuelEntries: [{ id: 'known-incoming', type: 'incoming', date: '2026-08-22', quantityLiters: 1056 }],
  reports: [{ id: 'known-report', reportDate: '2026-08-22', fuel: { consumedDaily: 228 } }]
});
equal('1056 minus 228 equals 828', known.currentBalance, 828);

if (failed) process.exit(1);
console.log(`RESULTS: ${passed}/${passed + failed} PASS`);
