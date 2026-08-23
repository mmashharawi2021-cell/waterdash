const assert = require('node:assert/strict');
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const projectId = 'waterdash-emulator';
const host = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
if (!['127.0.0.1:9099', 'localhost:9099', '[::1]:9099'].includes(host)) {
  throw new Error('FIREBASE_AUTH_EMULATOR_HOST must be the local WaterDash Auth emulator.');
}

async function main() {
  const app = getApps()[0] || initializeApp({ projectId });
  const auth = getAuth(app);
  const user = await auth.createUser({ email: 'trusted-admin@example.test', password: 'Safe-Emulator-Only-1!', disabled: false });
  await auth.setCustomUserClaims(user.uid, { waterdashRole: 'superAdmin' });
  const claimed = await auth.getUser(user.uid);
  assert.equal(claimed.customClaims.waterdashRole, 'superAdmin');
  await auth.updateUser(user.uid, { disabled: true });
  const disabled = await auth.getUser(user.uid);
  assert.equal(disabled.disabled, true);
  console.log('EMULATOR_AUTH_ADMIN_TESTS_PASSED=3');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
