/* Firebase Authentication and token-claim RBAC boundary.
 *
 * This file intentionally overrides the legacy AuthUsers implementation loaded
 * before it. Legacy users/passwordHash data remains for migration evidence but
 * is not read, written, or verified by this active path.
 */
window.AuthUsers = (() => {
  const CANONICAL_ROLES = ['superAdmin', 'supervisor', 'dataEntry', 'viewer'];
  let tokenUser = null;

  const ROLE_DEFINITIONS = {
    superAdmin: { label: 'مدير النظام', permissions: { viewReports: true, createReports: true, editReports: true, deleteReports: true, viewFuel: true, addFuel: true, editFuel: true, deleteFuel: true, exportPdf: true, exportExcel: true, shareWhatsapp: true, manageUsers: true, manageSettings: true, manageStations: true } },
    supervisor: { label: 'مشرف تشغيل', permissions: { viewReports: true, createReports: true, editReports: true, deleteReports: false, viewFuel: true, addFuel: true, editFuel: true, deleteFuel: false, exportPdf: true, exportExcel: true, shareWhatsapp: true, manageUsers: false, manageSettings: true, manageStations: true } },
    dataEntry: { label: 'مدخل بيانات', permissions: { viewReports: true, createReports: true, editReports: false, deleteReports: false, viewFuel: true, addFuel: true, editFuel: false, deleteFuel: false, exportPdf: false, exportExcel: false, shareWhatsapp: false, manageUsers: false, manageSettings: false, manageStations: false } },
    viewer: { label: 'مشاهد', permissions: { viewReports: true, createReports: false, editReports: false, deleteReports: false, viewFuel: true, addFuel: false, editFuel: false, deleteFuel: false, exportPdf: true, exportExcel: true, shareWhatsapp: false, manageUsers: false, manageSettings: false, manageStations: false } }
  };

  const PERMISSION_LABELS = {
    viewReports: 'عرض التقارير', createReports: 'إضافة تقرير', editReports: 'تعديل تقرير', deleteReports: 'حذف تقرير',
    viewFuel: 'عرض الوقود', addFuel: 'إضافة وقود', editFuel: 'تعديل الوقود', deleteFuel: 'حذف الوقود',
    exportPdf: 'تصدير PDF', exportExcel: 'تصدير Excel', shareWhatsapp: 'إرسال واتساب',
    manageUsers: 'إدارة المستخدمين', manageSettings: 'تعديل الإعدادات', manageStations: 'إدارة المحطات'
  };

  function clearCurrentUser() {
    tokenUser = null;
    window.WaterCurrentUser = null;
    try { localStorage.removeItem('waterAppCurrentUser'); } catch {}
  }

  async function syncFirebaseUser(firebaseUser) {
    if (!firebaseUser) {
      clearCurrentUser();
      return null;
    }
    const token = await firebaseUser.getIdTokenResult();
    const role = String(token.claims.waterdashRole || '');
    const permissions = ROLE_DEFINITIONS[role]?.permissions || {};
    tokenUser = {
      id: firebaseUser.uid,
      uid: firebaseUser.uid,
      fullName: firebaseUser.displayName || firebaseUser.email || firebaseUser.uid,
      username: firebaseUser.email || firebaseUser.uid,
      role: CANONICAL_ROLES.includes(role) ? role : 'unassigned',
      roleLabel: ROLE_DEFINITIONS[role]?.label || 'غير مخوّل',
      active: CANONICAL_ROLES.includes(role),
      permissions: { ...permissions }
    };
    window.WaterCurrentUser = tokenUser;
    return tokenUser;
  }

  function currentUser() {
    return tokenUser;
  }

  function hasPermission(permission) {
    return tokenUser?.permissions?.[permission] === true;
  }

  function requirePermission(permission, label = 'هذا الإجراء') {
    if (hasPermission(permission)) return true;
    window.App?.toast?.(`لا تملك صلاحية: ${label}`, 'warn');
    return false;
  }

  async function signIn(email, password) {
    window.FirebaseService?.init?.();
    const normalizedEmail = String(email || '').trim();
    if (!normalizedEmail.includes('@')) throw new Error('أدخل بريدًا إلكترونيًا صالحًا.');
    return firebase.auth().signInWithEmailAndPassword(normalizedEmail, String(password || ''));
  }

  async function signOut() {
    clearCurrentUser();
    window.FirebaseService?.init?.();
    return firebase.auth().signOut();
  }

  function migrationOnlyError() {
    throw new Error('إدارة المستخدمين والأدوار متاحة فقط عبر آلية Firebase Admin الموثوقة أثناء الترحيل.');
  }

  return {
    CANONICAL_ROLES,
    ROLE_DEFINITIONS,
    PERMISSION_LABELS,
    currentUser,
    clearCurrentUser,
    syncFirebaseUser,
    hasPermission,
    requirePermission,
    signIn,
    signOut,
    isRoleManagementAvailable: () => false,
    listUsers: migrationOnlyError,
    saveUser: migrationOnlyError,
    setUserActive: migrationOnlyError,
    deleteUser: migrationOnlyError
  };
})();
