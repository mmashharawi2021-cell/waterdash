(() => {
  async function ensureAnonymousAuth() {
    window.FirebaseService?.init?.();
    const auth = firebase.auth();
    if (!auth.currentUser) await auth.signInAnonymously();
    return auth.currentUser;
  }

  async function hashPassword(password) {
    if (window.AuthUsers?.hashPassword) return window.AuthUsers.hashPassword(password);
    const raw = new TextEncoder().encode(String(password || ''));
    const digest = await crypto.subtle.digest('SHA-256', raw);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function db() {
    window.FirebaseService?.init?.();
    return firebase.firestore();
  }

  async function ensureDefaultAdminFixed() {
    await ensureAnonymousAuth();
    const settings = window.WATER_APP_SETTINGS || {};
    const username = settings.defaultUserName || 'صالح الدحنون';
    const ref = db().collection('users');
    const snap = await ref.where('username', '==', username).limit(1).get();
    if (!snap.empty) {
      return window.AuthUsers.normalizeUser(snap.docs[0]);
    }

    const payload = {
      fullName: username,
      username,
      passwordHash: await hashPassword(username),
      role: 'superAdmin',
      active: true,
      permissions: window.AuthUsers.ROLE_DEFINITIONS.superAdmin.permissions,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: 'system'
    };
    const doc = await ref.add(payload);
    return window.AuthUsers.normalizeUser({ id: doc.id, ...payload });
  }

  async function findUserByUsernameFixed(username) {
    await ensureAnonymousAuth();
    const snap = await db().collection('users').where('username', '==', String(username || '').trim()).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  async function signInFixed(username, password) {
    await ensureAnonymousAuth();
    await ensureDefaultAdminFixed();

    const user = await findUserByUsernameFixed(username);
    if (!user || user.active === false) throw new Error('بيانات الدخول غير صحيحة أو المستخدم غير فعال.');

    const incomingHash = await hashPassword(password);
    const ok = user.passwordHash ? incomingHash === user.passwordHash : String(password) === String(user.password || '');
    if (!ok) throw new Error('بيانات الدخول غير صحيحة.');

    const normalized = window.AuthUsers.setCurrentUser(user);
    await db().collection('activityLogs').add({
      actionType: 'login',
      userName: normalized.fullName,
      userRole: normalized.roleLabel,
      authUid: firebase.auth().currentUser?.uid || null,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(console.warn);

    return firebase.auth().currentUser;
  }

  async function listUsersFixed() {
    await ensureDefaultAdminFixed();
    const snap = await db().collection('users').orderBy('createdAt', 'asc').get();
    return snap.docs.map(window.AuthUsers.normalizeUser);
  }

  function patchLoginFix() {
    if (!window.FirebaseService || !window.AuthUsers || window.FirebaseService.__usersLoginFixPatched) return;
    window.FirebaseService.signIn = signInFixed;
    window.FirebaseService.listUsers = listUsersFixed;
    window.FirebaseService.ensureDefaultAdmin = ensureDefaultAdminFixed;
    window.AuthUsers.ensureDefaultAdmin = ensureDefaultAdminFixed;
    window.AuthUsers.listUsers = listUsersFixed;
    window.FirebaseService.__usersLoginFixPatched = true;
  }

  patchLoginFix();
  window.addEventListener('DOMContentLoaded', patchLoginFix);
})();
