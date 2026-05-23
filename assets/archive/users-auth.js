(() => {
  const USERS_COLLECTION = 'users';
  const USER_KEY = 'waterAppCurrentUser';

  const ROLE_DEFINITIONS = {
    superAdmin: {
      label: 'مدير النظام',
      permissions: {
        viewReports: true,
        createReports: true,
        editReports: true,
        deleteReports: true,
        exportPdf: true,
        exportExcel: true,
        shareWhatsapp: true,
        manageUsers: true,
        manageSettings: true
      }
    },
    supervisor: {
      label: 'مشرف تشغيل',
      permissions: {
        viewReports: true,
        createReports: true,
        editReports: true,
        deleteReports: false,
        exportPdf: true,
        exportExcel: true,
        shareWhatsapp: true,
        manageUsers: false,
        manageSettings: true
      }
    },
    dataEntry: {
      label: 'مدخل بيانات',
      permissions: {
        viewReports: true,
        createReports: true,
        editReports: false,
        deleteReports: false,
        exportPdf: false,
        exportExcel: false,
        shareWhatsapp: false,
        manageUsers: false,
        manageSettings: false
      }
    },
    viewer: {
      label: 'مشاهد',
      permissions: {
        viewReports: true,
        createReports: false,
        editReports: false,
        deleteReports: false,
        exportPdf: true,
        exportExcel: true,
        shareWhatsapp: false,
        manageUsers: false,
        manageSettings: false
      }
    }
  };

  const PERMISSION_LABELS = {
    viewReports: 'عرض التقارير',
    createReports: 'إضافة تقرير',
    editReports: 'تعديل تقرير',
    deleteReports: 'حذف تقرير',
    exportPdf: 'تصدير PDF',
    exportExcel: 'تصدير Excel',
    shareWhatsapp: 'إرسال واتساب',
    manageUsers: 'إدارة المستخدمين',
    manageSettings: 'تعديل الإعدادات'
  };

  function db() {
    window.FirebaseService?.init?.();
    return firebase.firestore();
  }

  function normalizeUser(doc) {
    const data = doc?.data ? doc.data() : doc || {};
    const role = data.role || 'viewer';
    const defaults = ROLE_DEFINITIONS[role]?.permissions || ROLE_DEFINITIONS.viewer.permissions;
    return {
      id: doc?.id || data.id || '',
      fullName: data.fullName || data.name || '',
      username: data.username || '',
      role,
      roleLabel: ROLE_DEFINITIONS[role]?.label || role,
      active: data.active !== false,
      permissions: { ...defaults, ...(data.permissions || {}) },
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null,
      createdBy: data.createdBy || ''
    };
  }

  async function hashPassword(password) {
    const raw = new TextEncoder().encode(String(password || ''));
    const digest = await crypto.subtle.digest('SHA-256', raw);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function setCurrentUser(user) {
    const normalized = normalizeUser(user || {});
    localStorage.setItem(USER_KEY, JSON.stringify(normalized));
    window.WaterCurrentUser = normalized;
    return normalized;
  }

  function currentUser() {
    if (window.WaterCurrentUser) return window.WaterCurrentUser;
    try {
      const saved = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
      if (saved) return setCurrentUser(saved);
    } catch {}
    return null;
  }

  function clearCurrentUser() {
    localStorage.removeItem(USER_KEY);
    window.WaterCurrentUser = null;
  }

  function hasPermission(permission) {
    const user = currentUser();
    if (!user) return false;
    if (user.role === 'superAdmin') return true;
    return user.permissions?.[permission] === true;
  }

  function requirePermission(permission, label = 'هذا الإجراء') {
    if (hasPermission(permission)) return true;
    window.App?.toast?.('لا تملك صلاحية: ' + label, 'warn');
    alert('لا تملك صلاحية تنفيذ هذا الإجراء.');
    return false;
  }

  async function ensureDefaultAdmin() {
    const settings = window.WATER_APP_SETTINGS || {};
    const username = settings.defaultUserName || 'صالح الدحنون';
    const ref = db().collection(USERS_COLLECTION);
    const snap = await ref.where('username', '==', username).limit(1).get();
    if (!snap.empty) return normalizeUser(snap.docs[0]);

    const passwordHash = await hashPassword(username);
    const payload = {
      fullName: username,
      username,
      passwordHash,
      role: 'superAdmin',
      active: true,
      permissions: ROLE_DEFINITIONS.superAdmin.permissions,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: 'system'
    };
    const doc = await ref.add(payload);
    return normalizeUser({ id: doc.id, ...payload });
  }

  async function findUserByUsername(username) {
    const snap = await db().collection(USERS_COLLECTION).where('username', '==', String(username || '').trim()).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  async function signIn(username, password) {
    window.FirebaseService?.init?.();
    await ensureDefaultAdmin();
    const user = await findUserByUsername(username);
    if (!user || user.active === false) throw new Error('بيانات الدخول غير صحيحة أو المستخدم غير فعال.');

    const incomingHash = await hashPassword(password);
    const ok = user.passwordHash ? incomingHash === user.passwordHash : String(password) === String(user.password || '');
    if (!ok) throw new Error('بيانات الدخول غير صحيحة.');

    const normalized = setCurrentUser(user);
    const auth = firebase.auth();
    if (!auth.currentUser) await auth.signInAnonymously();
    await db().collection('activityLogs').add({
      actionType: 'login',
      userName: normalized.fullName,
      userRole: normalized.roleLabel,
      authUid: auth.currentUser?.uid || null,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(console.warn);
    return auth.currentUser;
  }

  async function signOut() {
    const name = currentUser()?.fullName || '';
    clearCurrentUser();
    await db().collection('activityLogs').add({
      actionType: 'logout',
      userName: name,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(console.warn);
    return firebase.auth().signOut();
  }

  async function listUsers() {
    await ensureDefaultAdmin();
    const snap = await db().collection(USERS_COLLECTION).orderBy('createdAt', 'asc').get();
    return snap.docs.map(normalizeUser);
  }

  async function saveUser(input) {
    if (!hasPermission('manageUsers')) throw new Error('لا تملك صلاحية إدارة المستخدمين.');
    const ref = db().collection(USERS_COLLECTION);
    const role = input.role || 'viewer';
    const basePermissions = ROLE_DEFINITIONS[role]?.permissions || ROLE_DEFINITIONS.viewer.permissions;
    const payload = {
      fullName: String(input.fullName || '').trim(),
      username: String(input.username || '').trim(),
      role,
      active: input.active !== false,
      permissions: { ...basePermissions, ...(input.permissions || {}) },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentUser()?.fullName || ''
    };

    if (!payload.fullName || !payload.username) throw new Error('الاسم واسم المستخدم مطلوبان.');
    if (input.password) payload.passwordHash = await hashPassword(input.password);

    if (input.id) {
      await ref.doc(input.id).set(payload, { merge: true });
      return input.id;
    }

    const existing = await findUserByUsername(payload.username);
    if (existing) throw new Error('اسم المستخدم موجود مسبقًا.');
    if (!input.password) throw new Error('كلمة المرور مطلوبة للمستخدم الجديد.');
    payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    payload.createdBy = currentUser()?.fullName || '';
    const doc = await ref.add(payload);
    return doc.id;
  }

  async function setUserActive(id, active) {
    if (!hasPermission('manageUsers')) throw new Error('لا تملك صلاحية إدارة المستخدمين.');
    await db().collection(USERS_COLLECTION).doc(id).set({
      active: Boolean(active),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentUser()?.fullName || ''
    }, { merge: true });
  }

  async function deleteUser(id) {
    if (!hasPermission('manageUsers')) throw new Error('لا تملك صلاحية إدارة المستخدمين.');
    await db().collection(USERS_COLLECTION).doc(id).delete();
  }

  function patchFirebaseService() {
    if (!window.FirebaseService || window.FirebaseService.__usersPatched) return;
    const original = window.FirebaseService;
    const originalSaveReport = original.saveReport;
    const originalDeleteReport = original.deleteReport;
    original.signIn = signIn;
    original.signOut = signOut;
    original.listUsers = listUsers;
    original.saveUser = saveUser;
    original.setUserActive = setUserActive;
    original.deleteUser = deleteUser;
    original.ensureDefaultAdmin = ensureDefaultAdmin;
    original.currentAppUser = currentUser;

    original.saveReport = async function patchedSaveReport(report, authUser, existingId) {
      const appUser = currentUser();
      const payload = {
        ...report,
        updatedBy: appUser?.fullName || report.updatedBy || '',
        updatedByRole: appUser?.roleLabel || appUser?.role || ''
      };
      const id = await originalSaveReport.call(original, payload, authUser, existingId);
      await db().collection('reports').doc(id).set({
        updatedBy: appUser?.fullName || '',
        updatedByRole: appUser?.roleLabel || appUser?.role || '',
        createdBy: existingId ? firebase.firestore.FieldValue.delete() : (appUser?.fullName || '')
      }, { merge: true }).catch(console.warn);
      return id;
    };

    original.deleteReport = async function patchedDeleteReport(id, authUser) {
      const appUser = currentUser();
      await originalDeleteReport.call(original, id, authUser);
      await db().collection('activityLogs').add({
        actionType: 'delete-report-by-user',
        userName: appUser?.fullName || '',
        userRole: appUser?.roleLabel || appUser?.role || '',
        reportId: id,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(console.warn);
    };

    original.__usersPatched = true;
  }

  window.AuthUsers = {
    ROLE_DEFINITIONS,
    PERMISSION_LABELS,
    currentUser,
    setCurrentUser,
    clearCurrentUser,
    hasPermission,
    requirePermission,
    hashPassword,
    listUsers,
    saveUser,
    setUserActive,
    deleteUser,
    ensureDefaultAdmin,
    normalizeUser
  };

  patchFirebaseService();
  window.addEventListener('DOMContentLoaded', patchFirebaseService);
})();
