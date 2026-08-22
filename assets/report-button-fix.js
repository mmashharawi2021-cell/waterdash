(() => {
  const VERSION = '20260822-report-button-fix-2';
  const ID = 'fixedAddReportButton';

  function canCreateReports() {
    const auth = window.AuthUsers;
    if (!auth?.currentUser) return true;
    const user = auth.currentUser();
    if (!user) return true;
    if (user.role === 'superAdmin' || user.roleLabel === 'مدير النظام') return true;
    return auth.hasPermission?.('createReports') === true;
  }

  function openReport() {
    if (typeof window.App?.openNew === 'function') window.App.openNew();
  }

  function ensureButton() {
    const old = document.getElementById(ID);
    if (!canCreateReports() || typeof window.App?.openNew !== 'function') {
      old?.remove();
      return;
    }

    let button = old;
    if (!button) {
      button = document.createElement('button');
      button.id = ID;
      button.type = 'button';
      button.textContent = '➕ إضافة تقرير جديد';
      button.addEventListener('click', openReport);
      document.body.appendChild(button);
    }

    button.dataset.reportButtonFix = VERSION;
    Object.assign(button.style, {
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      position: 'fixed',
      right: '18px',
      bottom: '96px',
      zIndex: '2147483000',
      minWidth: '172px',
      minHeight: '46px',
      padding: '11px 17px',
      border: '1px solid rgba(255,255,255,.28)',
      borderRadius: '999px',
      background: 'linear-gradient(135deg,#0284c7,#0ea5e9)',
      color: '#fff',
      fontFamily: 'Cairo, sans-serif',
      fontSize: '14px',
      fontWeight: '900',
      lineHeight: '1.4',
      boxShadow: '0 14px 34px rgba(2,132,199,.35)',
      cursor: 'pointer',
      pointerEvents: 'auto'
    });

    const hero = document.querySelector('.hero-actions');
    const heroButton = hero && [...hero.querySelectorAll('button')].find(btn =>
      /إضافة\s+تقرير\s+جديد/.test(btn.textContent || '') || (btn.getAttribute('onclick') || '').includes('App.openNew')
    );
    if (heroButton) {
      heroButton.hidden = false;
      heroButton.style.setProperty('display', 'inline-flex', 'important');
      heroButton.style.setProperty('visibility', 'visible', 'important');
      heroButton.style.setProperty('opacity', '1', 'important');
    }
  }

  function run() {
    ensureButton();
    [100, 400, 1000, 2500].forEach(ms => setTimeout(ensureButton, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();

  const observer = new MutationObserver(() => {
    clearTimeout(window.__reportButtonFixTimer);
    window.__reportButtonFixTimer = setTimeout(ensureButton, 30);
  });
  const observe = () => document.body && observer.observe(document.body, { childList: true, subtree: true });
  if (document.body) observe(); else document.addEventListener('DOMContentLoaded', observe);

  try { firebase.auth().onAuthStateChanged(() => setTimeout(run, 250)); } catch {}
})();
