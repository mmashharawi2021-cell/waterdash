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
    const modal = document.getElementById('usersModal');
    if (!modal) return;
    modal.classList.add('open');
    renderUsersPage().catch(error => {
      console.error(error);
      document.getElementById('usersContent').innerHTML = `<div class="notice warn"><p>${esc(error.message || 'تعذر تحميل المستخدمين.')}</p></div>`;
    });
  }

  function close() {
    document.getElementById('usersModal')?.classList.remove('open');
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
      const usersButton = canManageUsers ? `<button class="btn" onclick="UsersUI.open()">👥 المستخدمون</button>` : '';
      html = html.replace('<button class="btn" onclick="App.openSettings()">⚙️ الإعدادات</button>', `${usersButton}<button class="btn" onclick="App.openSettings()">⚙️ الإعدادات</button>`);
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
