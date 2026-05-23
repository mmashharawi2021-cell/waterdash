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
