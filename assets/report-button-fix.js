(() => {
  const VERSION = '20260822-report-button-fix-1';

  function canCreateReports() {
    const auth = window.AuthUsers;
    if (!auth?.currentUser) return true;
    const user = auth.currentUser();
    if (!user) return true;
    if (user.role === 'superAdmin' || user.roleLabel === 'مدير النظام') return true;
    return auth.hasPermission?.('createReports') === true;
  }

  function ensureAddReportButton() {
    if (!canCreateReports() || typeof window.App?.openNew !== 'function') return;
    const heroActions = document.querySelector('.hero-actions');
    if (!heroActions) return;

    const existing = [...heroActions.querySelectorAll('button')].find(btn =>
      /إضافة\s+تقرير\s+جديد/.test(btn.textContent || '') ||
      (btn.getAttribute('onclick') || '').includes('App.openNew')
    );
    if (existing) {
      existing.style.removeProperty('display');
      existing.hidden = false;
      existing.dataset.reportButtonFix = VERSION;
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn toolbar-btn toolbar-main';
    button.dataset.reportButtonFix = VERSION;
    button.textContent = '➕ إضافة تقرير جديد';
    button.addEventListener('click', () => window.App?.openNew?.());
    heroActions.prepend(button);
  }

  function run() {
    ensureAddReportButton();
    setTimeout(ensureAddReportButton, 100);
    setTimeout(ensureAddReportButton, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();

  const observer = new MutationObserver(() => ensureAddReportButton());
  const startObserver = () => document.body && observer.observe(document.body, { childList: true, subtree: true });
  if (document.body) startObserver(); else document.addEventListener('DOMContentLoaded', startObserver);

  try { firebase.auth().onAuthStateChanged(() => setTimeout(run, 250)); } catch {}
})();
