const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const makeEl = () => ({ classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {}, remove() {}, setAttribute() {}, removeAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {} });
global.window = { addEventListener() {}, WATER_APP_SETTINGS: { fuelRate: 19 } };
global.document = { addEventListener() {}, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }, createElement: makeEl, body: makeEl() };

const fuelCode = fs.readFileSync(path.join(__dirname, 'assets/fuel-system.js'), 'utf8');
eval(fuelCode.replace('init();', ''));

let passed = 0;
function equal(label, actual, expected) {
  assert.deepEqual(actual, expected, label);
  passed += 1;
  console.log(`[PASS] ${label}`);
}
function throws(label, callback) {
  assert.throws(callback);
  passed += 1;
  console.log(`[PASS] ${label}`);
}

const historicalEntries = [
  { id: 'pre-cycle', type: 'incoming', date: '2026-08-21', quantityLiters: 20370 },
  { id: 'verified-incoming', type: 'incoming', date: '2026-08-22', quantityLiters: 1056 },
  { id: 'new-cycle-incoming', type: 'incoming', date: '2026-08-23', quantityLiters: 44 }
];
const historicalReports = [
  { id: 'historic-report', reportDate: '2026-08-21', fuel: { consumedDaily: 9999 } },
  { id: 'verified-report', reportDate: '2026-08-22', fuel: { consumedDaily: 228 } },
  { id: 'new-cycle-report', reportDate: '2026-08-23', fuel: { consumedDaily: 20 } }
];

const beforeEntries = structuredClone(historicalEntries);
const beforeReports = structuredClone(historicalReports);
const verified = window.WaterFuel.getCycleLedger({ fuelEntries: historicalEntries, reports: historicalReports, cycleStart: '2026-08-22' });
equal('2026-08-22 is inclusive', verified.incomingFuel, 1100);
equal('verified 1056 minus 228 balance remains reproducible', window.WaterFuel.getCycleLedger({ fuelEntries: [historicalEntries[1]], reports: [historicalReports[1]], cycleStart: '2026-08-22' }).currentBalance, 828);
equal('pre-reset fuel entry is excluded', verified.entriesUsed.some(entry => entry.id === 'pre-cycle'), false);
equal('pre-reset report is excluded', verified.reportsUsed.some(report => report.id === 'historic-report'), false);
equal('reset calculation preserves historical fuel entries', historicalEntries, beforeEntries);
equal('reset calculation preserves historical reports', historicalReports, beforeReports);

const resetPreview = window.WaterFuel.getCycleLedger({ fuelEntries: historicalEntries, reports: historicalReports, cycleStart: '2026-08-23' });
equal('new boundary uses only 2026-08-23 incoming fuel', resetPreview.incomingFuel, 44);
equal('new boundary uses only 2026-08-23 report consumption', resetPreview.reportConsumption, 20);
equal('new boundary balance is canonical incoming minus consumption', resetPreview.currentBalance, 24);
const restorePreview = window.WaterFuel.getCycleLedger({ fuelEntries: historicalEntries, reports: historicalReports, cycleStart: '2026-08-22' });
equal('restore preview matches saved-ledger calculation', restorePreview.currentBalance, verified.currentBalance);
throws('invalid cycle date is rejected', () => window.WaterFuel.getCycleLedger({ fuelEntries: [], reports: [], cycleStart: '2026-02-30' }));
equal('Palestine-local date remains 2026-08-22 before midnight in Gaza', window.WaterFuel.palestineDate(new Date('2026-08-22T20:30:00Z')), '2026-08-22');
equal('Palestine-local date advances after midnight in Gaza', window.WaterFuel.palestineDate(new Date('2026-08-22T21:30:00Z')), '2026-08-23');

console.log(`FUEL_CYCLE_ADMIN_TESTS_PASSED=${passed}`);
