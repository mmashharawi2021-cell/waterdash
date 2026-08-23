const fs = require('node:fs');
const assert = require('node:assert/strict');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc } = require('firebase/firestore');

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
    await setDoc(doc(adminDb, 'stations/main'), { name: 'Main' });
    await setDoc(doc(adminDb, 'users/legacy'), { username: 'legacy', role: 'admin', passwordHash: 'not-used' });
  });
  check(Boolean(seed === undefined), 'emulator seed completed');

  // Original P0 path: direct self-document writes cannot create admin aliases.
  await assertFails(setDoc(doc(db('attacker'), 'users/attacker'), { role: 'admin' })); passed += 1;
  await assertFails(setDoc(doc(db('attacker'), 'users/attacker'), { role: 'superAdmin' })); passed += 1;
  await assertFails(getDoc(doc(db('attacker'), 'reports/seed'))); passed += 1;
  await assertFails(setDoc(doc(db('attacker'), 'settings/main'), { unsafe: true })); passed += 1;
  await assertFails(setDoc(doc(db('attacker'), 'stations/main'), { unsafe: true })); passed += 1;

  // Viewer: read-only operational access; legacy credentials remain hidden.
  await assertSucceeds(getDoc(doc(db('viewer', 'viewer'), 'reports/seed'))); passed += 1;
  await assertSucceeds(getDoc(doc(db('viewer', 'viewer'), 'fuelEntries/seed'))); passed += 1;
  await assertFails(setDoc(doc(db('viewer', 'viewer'), 'reports/viewer-create'), { title: 'no' })); passed += 1;
  await assertFails(deleteDoc(doc(db('viewer', 'viewer'), 'reports/seed'))); passed += 1;
  await assertFails(getDoc(doc(db('viewer', 'viewer'), 'users/legacy'))); passed += 1;

  // Data entry may add operational data but cannot alter existing history.
  await assertSucceeds(setDoc(doc(db('entry', 'dataEntry'), 'reports/entry-create'), { title: 'yes' })); passed += 1;
  await assertSucceeds(setDoc(doc(db('entry', 'dataEntry'), 'fuelEntries/entry-create'), { quantityLiters: 12 })); passed += 1;
  await assertFails(updateDoc(doc(db('entry', 'dataEntry'), 'reports/seed'), { title: 'no' })); passed += 1;
  await assertFails(deleteDoc(doc(db('entry', 'dataEntry'), 'fuelEntries/seed'))); passed += 1;
  await assertFails(updateDoc(doc(db('entry', 'dataEntry'), 'settings/main'), { appName: 'no' })); passed += 1;

  // Supervisor can create/edit operations and settings/stations, but not delete.
  await assertSucceeds(updateDoc(doc(db('supervisor', 'supervisor'), 'reports/seed'), { title: 'supervised' })); passed += 1;
  await assertSucceeds(updateDoc(doc(db('supervisor', 'supervisor'), 'fuelEntries/seed'), { quantityLiters: 11 })); passed += 1;
  await assertSucceeds(updateDoc(doc(db('supervisor', 'supervisor'), 'settings/main'), { appName: 'updated' })); passed += 1;
  await assertSucceeds(updateDoc(doc(db('supervisor', 'supervisor'), 'stations/main'), { name: 'updated' })); passed += 1;
  await assertFails(deleteDoc(doc(db('supervisor', 'supervisor'), 'reports/seed'))); passed += 1;
  await assertFails(setDoc(doc(db('supervisor', 'supervisor'), 'users/supervisor'), { role: 'superAdmin' })); passed += 1;

  // Super-admin can perform intended operational administration, but cannot
  // manage claims/legacy user records through Firestore.
  await assertSucceeds(deleteDoc(doc(db('root', 'superAdmin'), 'reports/seed'))); passed += 1;
  await assertSucceeds(deleteDoc(doc(db('root', 'superAdmin'), 'fuelEntries/seed'))); passed += 1;
  await assertSucceeds(setDoc(doc(db('root', 'superAdmin'), 'settings/new'), { appName: 'new' })); passed += 1;
  await assertSucceeds(setDoc(doc(db('root', 'superAdmin'), 'stations/new'), { name: 'new' })); passed += 1;
  await assertFails(setDoc(doc(db('root', 'superAdmin'), 'users/root'), { role: 'viewer' })); passed += 1;
  await assertFails(getDoc(doc(db('root', 'superAdmin'), 'users/legacy'))); passed += 1;

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
