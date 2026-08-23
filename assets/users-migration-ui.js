/* Browser user management is deliberately unavailable until a trusted Admin
 * SDK management service is approved. Navigation remains available to a
 * super-admin so the migration state is explicit rather than silently broken.
 */
window.UsersUI = (() => {
  function message() {
    const host = document.getElementById('usersContent');
    if (host) host.innerHTML = '<div class="notice warn"><p>إدارة الحسابات والأدوار محصورة في آلية Firebase Admin الموثوقة أثناء الترحيل. لا يمكن للمتصفح إنشاء مستخدم أو تغيير دور أو تعطيل حساب.</p></div>';
  }

  function open() {
    if (!window.AuthUsers?.requirePermission?.('manageUsers', 'إدارة المستخدمين')) return;
    if (window.App?.state) {
      window.App.state.prevView = window.App.state.view;
      window.App.state.view = 'users';
      window.App.render();
    }
    requestAnimationFrame(message);
  }

  function close() {
    if (window.App?.state) {
      window.App.state.view = window.App.state.prevView || 'home';
      window.App.render();
    }
  }

  return { open, close, renderUsersPage: message };
})();
