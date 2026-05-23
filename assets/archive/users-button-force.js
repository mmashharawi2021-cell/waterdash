(() => {
  function currentUser() {
    return window.AuthUsers?.currentUser?.() || null;
  }

  function isAdmin() {
    const user = currentUser();
    if (!user) return false;
    return user.role === 'superAdmin' || user.roleLabel === 'مدير النظام' || user.permissions?.manageUsers === true;
  }

  function openUsers() {
    if (window.UsersUI?.open) return window.UsersUI.open();
    alert('صفحة المستخدمين لم تكتمل في التحميل. أعد تحميل الصفحة.');
  }

  function ensureUsersButton() {
    if (!isAdmin()) return;
    if (document.querySelector('[data-users-force-button="true"]')) return;

    const settingsButton = [...document.querySelectorAll('button')].find(btn => btn.textContent.includes('الإعدادات'));
    const heroActions = document.querySelector('.hero-actions');
    const bottomNav = document.querySelector('.bottom-nav');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn users-force-btn';
    button.dataset.usersForceButton = 'true';
    button.innerHTML = '👥 المستخدمون';
    button.addEventListener('click', openUsers);

    if (settingsButton?.parentElement) {
      settingsButton.parentElement.insertBefore(button, settingsButton);
    } else if (heroActions) {
      heroActions.appendChild(button);
    }

    if (bottomNav && !document.querySelector('[data-users-force-nav="true"]')) {
      const navButton = document.createElement('button');
      navButton.type = 'button';
      navButton.dataset.usersForceNav = 'true';
      navButton.innerHTML = '<span>👥</span><b>المستخدمون</b>';
      navButton.addEventListener('click', openUsers);
      bottomNav.insertBefore(navButton, bottomNav.firstChild);
    }
  }

  function patchHasPermissionSafety() {
    if (!window.AuthUsers || window.AuthUsers.__forceUsersButtonPermissionPatched) return;
    const original = window.AuthUsers.hasPermission;
    window.AuthUsers.hasPermission = function patchedHasPermission(permission) {
      const user = currentUser();
      if (permission === 'manageUsers' && isAdmin()) return true;
      if (user?.role === 'superAdmin' || user?.roleLabel === 'مدير النظام') return true;
      return original?.(permission) === true;
    };
    window.AuthUsers.__forceUsersButtonPermissionPatched = true;
  }

  function boot() {
    patchHasPermissionSafety();
    ensureUsersButton();
  }

  window.UsersButtonForce = { boot, ensureUsersButton };
  window.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', boot);
  setTimeout(boot, 300);
  setTimeout(boot, 1200);
  setInterval(ensureUsersButton, 2000);
})();
