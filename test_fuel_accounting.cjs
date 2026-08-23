const fs = require('fs');
const path = require('path');

function runTest() {
  global.window = {};
  global.document = {
    addEventListener: () => {},
    getElementById: () => ({ classList: { add: ()=>{}, remove: ()=>{} }, value: '', dataset: {} }),
    querySelector: () => null,
    createElement: () => ({ appendChild: () => {}, classList: { add: ()=>{}, remove: ()=>{} } }),
    body: { appendChild: () => {} }
  };
  global.requestAnimationFrame = (cb) => cb();
  
  // Mock dependencies
  window.WATER_APP_SETTINGS = { fuelRate: 19 };
  
  // Load utilities
  const fuelCode = fs.readFileSync(path.join(__dirname, 'assets/fuel-system.js'), 'utf8');
  const reportCode = fs.readFileSync(path.join(__dirname, 'assets/reports-system.js'), 'utf8');
  
  // Evaluate
  try {
    const safeFuel = fuelCode.replace('init();', '');
    eval(safeFuel);
    
    const safeReport = reportCode.replace('window.ReportUtils = {', 'window.ReportUtils = {');
    eval(safeReport);
  } catch(e) {
    console.error('Eval error:', e);
    process.exit(1);
  }
  
  let passed = 0;
  let failed = 0;
  
  function assert(name, actual, expected) {
    if (actual === expected) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} | Expected: ${expected} | Actual: ${actual}`);
      failed++;
    }
  }

  let report1 = {
    generator: { totalRunHours: '6:0' },
    fuel: { consumedDaily: '', currentBalance: '-3059.77' }
  };
  report1 = window.ReportUtils.recalc(report1);
  assert('Historical report corrupted negative balance -> cleared', report1.fuel.currentBalance, '');
  assert('Historical report consumedDaily calculated from runtime', report1.fuel.consumedDaily, '114');

  let report2 = {
    generator: { totalRunHours: '0:0' },
    fuel: { consumedDaily: '100', previousBalance: '500', currentBalance: '400' }
  };
  report2 = window.ReportUtils.recalc(report2);
  assert('Valid historical prev balance preserved', report2.fuel.previousBalance, '500');
  assert('Valid historical current balance preserved', report2.fuel.currentBalance, '400');

  let report3 = {
    generator: { totalRunHours: '10:30' },
    fuel: {}
  };
  report3 = window.ReportUtils.recalc(report3);
  assert('Half hour calculation', report3.fuel.consumedDaily, '199.5');

  console.log(`\nRESULTS: ${passed}/${passed+failed} PASS`);
  if (failed > 0) process.exit(1);
}

runTest();

