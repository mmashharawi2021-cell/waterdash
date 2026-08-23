const fs = require('node:fs');
const assert = require('node:assert/strict');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, runTransaction } = require('firebase/firestore');

const PROJECT_ID = 'waterdash-emulator';
let passed = 0;

function requireLoopback(name) {
  const value = process.env[name] || '';
  const host = value.split(':')[0];
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error(`${name} must target a loopback emulator; refusing test execution.`);
  }
}

function check(condition, label) {
  assert.ok(condition, label);
  passed += 1;
}

function fuelCyclePayload(uid, startDate, revision) {
  return { startDate, updatedAt: serverTimestamp(), updatedBy: uid, revision };
}

async function main() {
  requireLoopback('FIRESTORE_EMULATOR_HOST');
  requireLoopback('FIREBASE_AUTH_EMULATOR_HOST');
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
  const db = (uid, waterdashRole) => testEnv.authenticatedContext(uid, waterdashRole ? { waterdashRole } : {}).firestore();
  const seed = await testEnv.withSecurityRulesDisabled(async context => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'reports/seed'), { title: 'seed' });
    await setDoc(doc(adminDb, 'fuelEntries/seed'), { quantityLiters: 10 });
    await setDoc(doc(adminDb, 'settings/main'), { appName: 'WaterDash' });
    await setDoc(doc(adminDb, 'settings/fuelCycle'), { startDate: '2026-08-22', updatedAt: new Date(), updatedBy: 'bootstrap', revision: 1 });
    await setDoc(doc(adminDb, 'stations/main'), { name: 'Main' });
    await setDoc(doc(adminDb, 'users/legacy'), { username: 'legacy', role: 'admin', passwordHash: 'not-used' });
  });
  check(Boolean(seed === undefined), 'emulator seed completed');

  // Original P0 path: direct self-document writes cannot create admin aliases.
  await assertFails(setDoc(doc(db('attacker'), 'users/attacker'), { role: 'admin' })); passed += 1;
  await assertFails(setDoc(doc(db('attacker'), 'users/attacker'), { role: 'superAdmin' })); passed += 1;
  await assertFails(getDoc(doc(db('attacker'), 'reports/seed'))); passed += 1;
  await assertFails(getDoc(doc(db('invalid-claim', 'not-a-canonical-role'), 'reports/seed'))); passed += 1;
  await assertFails(setDoc(doc(db('attacker'), 'settings/main'), { unsafe: true })); passed += 1;
  await assertFails(updateDoc(doc(db('attacker'), 'settings/fuelCycle'), fuelCyclePayload('attacker', '2026-08-23', 2))); passed += 1;
  await assertFails(setDoc(doc(db('attacker'), 'stations/main'), { unsafe: true })); passed += 1;

  // Viewer: read-only operational access; legacy credentials remain hidden.
  await assertSucceeds(getDoc(doc(db('viewer', 'viewer'), 'reports/seed'))); passed += 1;
  await assertSucceeds(getDoc(doc(db('viewer', 'viewer'), 'fuelEntries/seed'))); passed += 1;
  await assertFails(setDoc(doc(db('viewer', 'viewer'), 'reports/viewer-create'), { title: 'no' })); passed += 1;
  await assertFails(deleteDoc(doc(db('viewer', 'viewer'), 'reports/seed'))); passed += 1;
  await assertFails(getDoc(doc(db('viewer', 'viewer'), 'users/legacy'))); passed += 1;
  await assertFails(updateDoc(doc(db('viewer', 'viewer'), 'settings/fuelCycle'), fuelCyclePayload('viewer', '2026-08-23', 2))); passed += 1;

  // Data entry may add operational data but cannot alter existing history.
  await assertSucceeds(setDoc(doc(db('entry', 'dataEntry'), 'reports/entry-create'), { title: 'yes' })); passed += 1;
  await assertSucceeds(setDoc(doc(db('entry', 'dataEntry'), 'fuelEntries/entry-create'), { quantityLiters: 12 })); passed += 1;
  await assertFails(updateDoc(doc(db('entry', 'dataEntry'), 'reports/seed'), { title: 'no' })); passed += 1;
  await assertFails(deleteDoc(doc(db('entry', 'dataEntry'), 'fuelEntries/seed'))); passed += 1;
  await assertFails(updateDoc(doc(db('entry', 'dataEntry'), 'settings/main'), { appName: 'no' })); passed += 1;
  await assertFails(updateDoc(doc(db('entry', 'dataEntry'), 'settings/fuelCycle'), fuelCyclePayload('entry', '2026-08-23', 2))); passed += 1;

  // Supervisor can create/edit operations and settings/stations, but not delete.
  await assertSucceeds(updateDoc(doc(db('supervisor', 'supervisor'), 'reports/seed'), { title: 'supervised' })); passed += 1;
  await assertSucceeds(updateDoc(doc(db('supervisor', 'supervisor'), 'fuelEntries/seed'), { quantityLiters: 11 })); passed += 1;
  await assertSucceeds(updateDoc(doc(db('supervisor', 'supervisor'), 'settings/main'), { appName: 'updated' })); passed += 1;
  await assertSucceeds(updateDoc(doc(db('supervisor', 'supervisor'), 'stations/main'), { name: 'updated' })); passed += 1;
  await assertFails(deleteDoc(doc(db('supervisor', 'supervisor'), 'reports/seed'))); passed += 1;
  await assertFails(setDoc(doc(db('supervisor', 'supervisor'), 'users/supervisor'), { role: 'superAdmin' })); passed += 1;
  await assertFails(updateDoc(doc(db('supervisor', 'supervisor'), 'settings/fuelCycle'), fuelCyclePayload('supervisor', '2026-08-23', 2))); passed += 1;

  // Super-admin can perform intended operational administration, but cannot
  // manage claims/legacy user records through Firestore.
  await assertSucceeds(deleteDoc(doc(db('root', 'superAdmin'), 'reports/seed'))); passed += 1;
  await assertSucceeds(deleteDoc(doc(db('root', 'superAdmin'), 'fuelEntries/seed'))); passed += 1;
  await assertSucceeds(setDoc(doc(db('root', 'superAdmin'), 'settings/new'), { appName: 'new' })); passed += 1;
  await assertSucceeds(setDoc(doc(db('root', 'superAdmin'), 'stations/new'), { name: 'new' })); passed += 1;
  await assertFails(setDoc(doc(db('root', 'superAdmin'), 'users/root'), { role: 'viewer' })); passed += 1;
  await assertFails(getDoc(doc(db('root', 'superAdmin'), 'users/legacy'))); passed += 1;
  await assertFails(updateDoc(doc(db('root', 'superAdmin'), 'settings/fuelCycle'), fuelCyclePayload('root', '2026-02-30', 2))); passed += 1;

  // A fuel-cycle boundary and its audit record must be changed atomically by
  // a super-admin. The Rules validate both the revision and getAfter state.
  const rootDb = db('root', 'superAdmin');
  await assertSucceeds(runTransaction(rootDb, async transaction => {
    const cycleRef = doc(rootDb, 'settings/fuelCycle');
    const auditRef = doc(rootDb, 'activityLogs/fuel-cycle-reset');
    const current = await transaction.get(cycleRef);
    assert.equal(current.data().startDate, '2026-08-22');
    transaction.update(cycleRef, fuelCyclePayload('root', '2026-08-23', 2));
    transaction.set(auditRef, {
      actionType: 'FUEL_CYCLE_RESET',
      previousCycleStart: '2026-08-22',
      newCycleStart: '2026-08-23',
      changedBy: 'root',
      changedAt: serverTimestamp(),
      cycleRevision: 2
    });
  })); passed += 1;
  await assertFails(setDoc(doc(db('viewer', 'viewer'), 'activityLogs/fake-fuel-cycle'), {
    actionType: 'FUEL_CYCLE_RESTORE',
    previousCycleStart: '2026-08-23',
    newCycleStart: '2026-08-22',
    changedBy: 'viewer',
    changedAt: serverTimestamp(),
    cycleRevision: 3
  })); passed += 1;

  // Private preference and append-only audit invariants remain intact.
  await assertSucceeds(setDoc(doc(db('viewer', 'viewer'), 'userPreferences/viewer'), { themeMode: 'dark' })); passed += 1;
  await assertFails(getDoc(doc(db('viewer', 'viewer'), 'userPreferences/other'))); passed += 1;
  await assertSucceeds(setDoc(doc(db('viewer', 'viewer'), 'activityLogs/viewer-log'), { actionType: 'view' })); passed += 1;
  await assertFails(updateDoc(doc(db('viewer', 'viewer'), 'activityLogs/viewer-log'), { actionType: 'rewrite' })); passed += 1;

  await testEnv.cleanup();
  console.log(`RULES_TESTS_PASSED=${passed}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
