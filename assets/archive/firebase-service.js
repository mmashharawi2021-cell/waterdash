window.FirebaseService = (() => {
  const cfg = window.WATER_APP_FIREBASE_CONFIG || {};
  const isConfigured = Boolean(cfg.apiKey && !String(cfg.apiKey).includes('PUT_YOUR'));
  let app = null;
  let auth = null;
  let db = null;

  function init() {
    if (!isConfigured) return { configured: false };
    if (!firebase.apps.length) app = firebase.initializeApp(cfg);
    else app = firebase.app();
    auth = firebase.auth();
    db = firebase.firestore();
    return { configured: true, app, auth, db };
  }

  function now() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function collection(name) {
    if (!db) init();
    return db.collection(name);
  }

  async function signIn(username, password) {
    init();
    const validUser = username === window.WATER_APP_SETTINGS.defaultUserName;
    const validPass = password === (window.WATER_APP_SETTINGS.defaultPassword || window.WATER_APP_SETTINGS.defaultUserName);
    if (!validUser || !validPass) throw new Error('بيانات الدخول غير صحيحة.');
    return auth.signInAnonymously();
  }

  async function signOut() {
    if (!auth) init();
    return auth.signOut();
  }

  function onAuth(callback) {
    init();
    return auth.onAuthStateChanged(callback);
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
    const payload = {
      ...report,
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
