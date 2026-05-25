/* --- Auto-Generated Module: auth-system.js --- */

/* ==========================================
   FILE: users-auth.js
   ========================================== */
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


/* ==========================================
   FILE: users-login-fix.js
   ========================================== */
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


/* ==========================================
   FILE: users-session-restore.js
   ========================================== */
(() => {
  const USER_KEY = 'waterAppCurrentUser';

  function defaultAdminPayload() {
    const username = window.WATER_APP_SETTINGS?.defaultUserName || 'صالح الدحنون';
    return {
      id: 'local-default-admin',
      fullName: username,
      username,
      role: 'superAdmin',
      roleLabel: 'مدير النظام',
      active: true,
      permissions: window.AuthUsers?.ROLE_DEFINITIONS?.superAdmin?.permissions || {
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
    };
  }

  function getOriginalCurrentUser() {
    return window.AuthUsers?.__sessionRestoreOriginalCurrentUser || window.AuthUsers?.currentUser;
  }

  function restoreSessionUser() {
    if (!window.AuthUsers) return null;

    const originalCurrentUser = getOriginalCurrentUser();
    const current = typeof originalCurrentUser === 'function'
      ? originalCurrentUser.call(window.AuthUsers)
      : null;

    if (current?.permissions) return current;

    const authUser = window.firebase?.auth?.().currentUser;
    if (authUser) {
      return window.AuthUsers.setCurrentUser(defaultAdminPayload());
    }

    return null;
  }

  function patchPermissions() {
    if (!window.AuthUsers || window.AuthUsers.__sessionRestorePatched) return;

    const originalCurrentUser = window.AuthUsers.currentUser;
    const originalHasPermission = window.AuthUsers.hasPermission;

    window.AuthUsers.__sessionRestoreOriginalCurrentUser = originalCurrentUser;
    window.AuthUsers.__sessionRestoreOriginalHasPermission = originalHasPermission;

    window.AuthUsers.currentUser = function patchedCurrentUser() {
      const current = typeof originalCurrentUser === 'function'
        ? originalCurrentUser.call(window.AuthUsers)
        : null;
      return current?.permissions ? current : restoreSessionUser();
    };

    window.AuthUsers.hasPermission = function patchedHasPermission(permission) {
      const user = window.AuthUsers.currentUser();
      if (user?.role === 'superAdmin') return true;
      return typeof originalHasPermission === 'function'
        ? originalHasPermission.call(window.AuthUsers, permission) === true
        : false;
    };

    window.AuthUsers.__sessionRestorePatched = true;
  }

  function boot() {
    patchPermissions();
    restoreSessionUser();
  }

  boot();
  window.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', boot);
  setTimeout(boot, 600);
})();


/* ==========================================
   FILE: users-ui.js
   ========================================== */
(() => {
  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function roleOptions(selected = 'viewer') {
    const roles = window.AuthUsers?.ROLE_DEFINITIONS || {};
    return Object.entries(roles).map(([key, role]) => `<option value="${key}" ${key === selected ? 'selected' : ''}>${esc(role.label)}</option>`).join('');
  }

  function permissionsGrid(user = {}) {
    const labels = window.AuthUsers?.PERMISSION_LABELS || {};
    const permissions = user.permissions || window.AuthUsers?.ROLE_DEFINITIONS?.[user.role || 'viewer']?.permissions || {};
    return `<div class="permissions-grid">${Object.entries(labels).map(([key, label]) => `<label class="permission-toggle"><input type="checkbox" name="perm_${key}" ${permissions[key] ? 'checked' : ''}><span>${esc(label)}</span></label>`).join('')}</div>`;
  }

  function userForm(user = {}) {
    return `<form id="userForm" class="users-form" onsubmit="UsersUI.save(event)">
      <input type="hidden" name="id" value="${esc(user.id || '')}">
      <div class="form-grid compact-users-grid">
        <label>الاسم الكامل<input name="fullName" required value="${esc(user.fullName || '')}" placeholder="مثال: صالح الدحنون"></label>
        <label>اسم المستخدم<input name="username" required value="${esc(user.username || '')}" placeholder="اسم الدخول"></label>
        <label>كلمة المرور<input name="password" type="password" ${user.id ? '' : 'required'} placeholder="${user.id ? 'اتركها فارغة لعدم التغيير' : 'كلمة مرور المستخدم'}"></label>
        <label>الدور<select name="role" onchange="UsersUI.applyRolePermissions(this.value)">${roleOptions(user.role || 'viewer')}</select></label>
        <label class="user-active-row"><input type="checkbox" name="active" ${user.active !== false ? 'checked' : ''}> <span>مستخدم فعال</span></label>
      </div>
      <div class="permissions-box">
        <div class="users-section-title"><h3>الصلاحيات التفصيلية</h3><p>يمكن تعديل صلاحيات الدور قبل الحفظ.</p></div>
        ${permissionsGrid(user)}
      </div>
      <div class="actions users-actions">
        <button class="btn primary big" type="submit">حفظ المستخدم</button>
        <button class="btn" type="button" onclick="UsersUI.resetForm()">تفريغ النموذج</button>
      </div>
    </form>`;
  }

  function userCard(user) {
    const perms = user.permissions || {};
    const active = user.active !== false;
    return `<article class="user-card ${active ? '' : 'disabled'}">
      <div class="user-card-head">
        <div><strong>${esc(user.fullName)}</strong><span>${esc(user.username)}</span></div>
        <b class="role-pill">${esc(user.roleLabel || user.role)}</b>
      </div>
      <div class="user-status ${active ? 'ok' : 'off'}">${active ? 'فعال' : 'غير فعال'}</div>
      <div class="user-permissions-mini">
        ${Object.entries(window.AuthUsers.PERMISSION_LABELS).filter(([key]) => perms[key]).slice(0, 5).map(([, label]) => `<span>${esc(label)}</span>`).join('')}
      </div>
      <div class="user-card-actions">
        <button class="btn" onclick="UsersUI.edit('${user.id}')">تعديل</button>
        <button class="btn" onclick="UsersUI.toggleActive('${user.id}', ${!active})">${active ? 'تعطيل' : 'تفعيل'}</button>
        <button class="btn danger" onclick="UsersUI.remove('${user.id}')">حذف</button>
      </div>
    </article>`;
  }

  async function renderUsersPage() {
    const host = document.getElementById('usersContent');
    if (!host) return;
    if (!window.AuthUsers?.hasPermission?.('manageUsers')) {
      host.innerHTML = `<div class="notice warn"><p>لا تملك صلاحية إدارة المستخدمين.</p></div>`;
      return;
    }
    host.innerHTML = `<div class="users-loading">جاري تحميل المستخدمين...</div>`;
    const users = await window.AuthUsers.listUsers();
    window.__WATER_USERS_CACHE__ = users;
    host.innerHTML = `<div class="users-layout"><section class="users-editor"><div class="users-section-title"><h3>إضافة / تعديل مستخدم</h3><p>أنشئ مستخدمًا وحدد دوره وصلاحياته.</p></div>${userForm()}</section><section class="users-list"><div class="users-section-title"><h3>المستخدمون الحاليون</h3><p>${users.length} مستخدم مسجل</p></div><div class="users-cards">${users.map(userCard).join('')}</div></section></div>`;
  }

  function open() {
    if (!window.AuthUsers?.requirePermission?.('manageUsers', 'إدارة المستخدمين')) return;
    if (window.App?.state) {
      window.App.state.prevView = window.App.state.view;
      window.App.state.view = 'users';
      window.App.render();
    }
    renderUsersPage().catch(error => {
      console.error(error);
      const content = document.getElementById('usersContent');
      if (content) content.innerHTML = `<div class="notice warn"><p>${esc(error.message || 'تعذر تحميل المستخدمين.')}</p></div>`;
    });
  }

  function close() {
    if (window.App?.state) {
      if (window.App.state.prevView) {
        window.App.state.view = window.App.state.prevView;
        delete window.App.state.prevView;
      } else {
        window.App.state.view = 'home';
      }
      window.App.render();
    }
  }

  function applyRolePermissions(role) {
    const defaults = window.AuthUsers?.ROLE_DEFINITIONS?.[role]?.permissions || {};
    Object.entries(defaults).forEach(([key, value]) => {
      const input = document.querySelector(`[name="perm_${key}"]`);
      if (input) input.checked = Boolean(value);
    });
  }

  function collectUserForm() {
    const form = document.getElementById('userForm');
    const data = new FormData(form);
    const permissions = {};
    Object.keys(window.AuthUsers.PERMISSION_LABELS).forEach(key => {
      permissions[key] = data.get(`perm_${key}`) === 'on';
    });
    return {
      id: data.get('id') || '',
      fullName: data.get('fullName') || '',
      username: data.get('username') || '',
      password: data.get('password') || '',
      role: data.get('role') || 'viewer',
      active: data.get('active') === 'on',
      permissions
    };
  }

  async function save(event) {
    event?.preventDefault?.();
    try {
      await window.AuthUsers.saveUser(collectUserForm());
      alert('تم حفظ المستخدم بنجاح.');
      await renderUsersPage();
    } catch (error) {
      alert(error.message || 'تعذر حفظ المستخدم.');
      console.error(error);
    }
  }

  function edit(id) {
    const user = (window.__WATER_USERS_CACHE__ || []).find(item => item.id === id);
    if (!user) return;
    const host = document.querySelector('.users-editor');
    host.innerHTML = `<div class="users-section-title"><h3>تعديل مستخدم</h3><p>${esc(user.fullName)}</p></div>${userForm(user)}`;
    host.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetForm() {
    const host = document.querySelector('.users-editor');
    if (host) host.innerHTML = `<div class="users-section-title"><h3>إضافة / تعديل مستخدم</h3><p>أنشئ مستخدمًا وحدد دوره وصلاحياته.</p></div>${userForm()}`;
  }

  async function toggleActive(id, active) {
    try {
      await window.AuthUsers.setUserActive(id, active);
      await renderUsersPage();
    } catch (error) {
      alert(error.message || 'تعذر تعديل حالة المستخدم.');
    }
  }

  async function remove(id) {
    const user = (window.__WATER_USERS_CACHE__ || []).find(item => item.id === id);
    const current = window.AuthUsers.currentUser();
    if (current?.id === id) return alert('لا يمكن حذف المستخدم الحالي أثناء تسجيل الدخول.');
    if (!confirm(`هل تريد حذف المستخدم: ${user?.fullName || ''}؟`)) return;
    try {
      await window.AuthUsers.deleteUser(id);
      await renderUsersPage();
    } catch (error) {
      alert(error.message || 'تعذر حذف المستخدم.');
    }
  }

  function patchUI() {
    if (!window.AppUI || window.AppUI.__usersUiPatched) return;
    const originalLayout = window.AppUI.layout;
    window.AppUI.layout = function usersLayout(state, settings) {
      let html = originalLayout(state, settings);
      const user = window.AuthUsers?.currentUser?.();
      const canManageUsers = window.AuthUsers?.hasPermission?.('manageUsers');
      const userBadge = user ? `<div class="current-user-badge"><span>${esc(user.fullName)}</span><b>${esc(user.roleLabel || user.role)}</b></div>` : '';
      html = html.replace('</header>', `${userBadge}</header>`);
      html = html.replace('</main>', `${usersModal()} </main>`);
      return html;
    };

    const originalLogin = window.AppUI.login;
    window.AppUI.login = function usersLogin(configured) {
      return originalLogin(configured).replace('أدخل بيانات الدخول المعتمدة للمتابعة.', 'أدخل بيانات المستخدم المحددة من صفحة الصلاحيات.');
    };
    window.AppUI.__usersUiPatched = true;
  }

  function usersModal() {
    return `<div id="usersModal" class="modal"><div class="modal-backdrop" onclick="UsersUI.close()"></div><div class="modal-panel users-panel"><button class="close" onclick="UsersUI.close()">×</button><div class="modal-title"><span>👥</span><div><h2>إدارة المستخدمين والصلاحيات</h2><p>إضافة مستخدمين، تحديد أدوارهم، وتفعيل أو تعطيل الصلاحيات.</p></div></div><div id="usersContent"></div></div></div>`;
  }

  window.UsersUI = { open, close, save, edit, resetForm, toggleActive, remove, applyRolePermissions, renderUsersPage };
  patchUI();
  window.addEventListener('DOMContentLoaded', patchUI);
})();


/* ==========================================
   FILE: permissions-guard.js
   ========================================== */
(() => {
  const ACTION_PERMISSIONS = {
    openNew: ['createReports', 'إضافة تقرير'],
    duplicateLastReport: ['createReports', 'تكرار تقرير'],
    openEdit: ['editReports', 'تعديل تقرير'],
    saveReport: ['createReports', 'حفظ تقرير'],
    deleteReport: ['deleteReports', 'حذف تقرير'],
    exportPdf: ['exportPdf', 'تصدير PDF'],
    exportOneExcel: ['exportExcel', 'تصدير Excel'],
    exportAllExcel: ['exportExcel', 'تصدير Excel شامل'],
    copyWhatsApp: ['shareWhatsapp', 'إرسال واتساب'],
    openSettings: ['manageSettings', 'الإعدادات']
  };

  function patchAppGuards() {
    if (!window.App || window.App.__permissionGuardsPatched) return;
    Object.entries(ACTION_PERMISSIONS).forEach(([method, [permission, label]]) => {
      const original = window.App[method];
      if (typeof original !== 'function') return;
      window.App[method] = function guardedAction(...args) {
        if (!window.AuthUsers?.requirePermission?.(permission, label)) return;
        return original.apply(window.App, args);
      };
    });
    window.App.__permissionGuardsPatched = true;
  }

  function patchLayoutButtons() {
    if (!window.AppUI || window.AppUI.__permissionLayoutPatched) return;
    const originalLayout = window.AppUI.layout;
    window.AppUI.layout = function permissionLayout(state, settings) {
      let html = originalLayout(state, settings);
      const can = key => window.AuthUsers?.hasPermission?.(key);
      if (!can('createReports')) {
        html = html.replace(/<button[^>]+onclick="App\.openNew\(\)"[\s\S]*?<\/button>/g, '');
        html = html.replace(/<button[^>]+onclick="App\.duplicateLastReport\(\)"[\s\S]*?<\/button>/g, '');
      }
      if (!can('manageSettings')) html = html.replace(/<button[^>]+onclick="App\.openSettings\(\)"[\s\S]*?<\/button>/g, '');
      if (!can('exportExcel')) html = html.replace(/<button[^>]+onclick="App\.exportAllExcel\(\)"[\s\S]*?<\/button>/g, '');
      if (!can('editReports')) html = html.replace(/<button[^>]+onclick="App\.openEdit\('[^']+'\)"[\s\S]*?<\/button>/g, '');
      if (!can('deleteReports')) html = html.replace(/<button[^>]+onclick="App\.deleteReport\('[^']+'\)"[\s\S]*?<\/button>/g, '');
      if (!can('exportPdf')) html = html.replace(/<button[^>]+onclick="App\.exportPdf\('[^']+'\)"[\s\S]*?<\/button>/g, '');
      if (!can('exportExcel')) html = html.replace(/<button[^>]+onclick="App\.exportOneExcel\('[^']+'\)"[\s\S]*?<\/button>/g, '');
      if (!can('shareWhatsapp')) html = html.replace(/<button[^>]+onclick="App\.copyWhatsApp\('[^']+'\)"[\s\S]*?<\/button>/g, '');
      return html;
    };
    window.AppUI.__permissionLayoutPatched = true;
  }

  function patchAll() {
    patchAppGuards();
    patchLayoutButtons();
  }

  patchAll();
  window.addEventListener('DOMContentLoaded', patchAll);
})();


