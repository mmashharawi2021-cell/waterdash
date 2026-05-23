(() => {
  const BUILD_ID = window.WATER_APP_BUILD || '20260518-production-sync-1';

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function can(permission) {
    if (!window.AuthUsers?.currentUser) return true;
    const user = window.AuthUsers.currentUser();
    if (!user) return true;
    if (user.role === 'superAdmin' || user.roleLabel === 'مدير النظام') return true;
    return window.AuthUsers.hasPermission?.(permission) === true;
  }

  function safeCall(code) {
    return code;
  }

  function actionButton(label, onclick, className = '') {
    return `<button class="btn toolbar-btn ${className}" type="button" onclick="${safeCall(onclick)}">${label}</button>`;
  }

  function buildHeroToolbar() {
    const heroActions = document.querySelector('.hero-actions');
    if (!heroActions || heroActions.dataset.productionToolbar === BUILD_ID) return;

    const main = can('createReports') ? actionButton('➕ إضافة تقرير جديد', 'App.openNew()', 'toolbar-main') : '';
    const fuel = actionButton('⛽ إضافة وقود وارد', 'WaterFuel.openFuelModal()', 'toolbar-fuel fuel-entry-open-btn');
    const exportCenter = actionButton('📦 مركز التصدير', 'WaterFuel.openExportCenter()', 'toolbar-export');
    const moreItems = [
      can('createReports') ? actionButton('⧉ تكرار آخر تقرير', 'App.duplicateLastReport()', 'more-item') : '',
      actionButton('📈 تقارير تجميعية', 'App.openSummary()', 'more-item'),
      can('manageUsers') ? '<button class="btn toolbar-btn more-item" data-users-force-button="true" type="button" onclick="UsersUI.open()">👥 المستخدمون</button>' : '',
      can('manageSettings') ? actionButton('⚙️ الإعدادات', 'App.openSettings()', 'more-item') : '',
      actionButton('🚪 خروج', 'App.logout()', 'more-item toolbar-logout')
    ].filter(Boolean).join('');

    heroActions.className = 'hero-actions professional-actions compact-toolbar';
    heroActions.dataset.productionToolbar = BUILD_ID;
    heroActions.innerHTML = `
      ${main}
      ${fuel}
      ${exportCenter}
      <div class="more-menu-wrap">
        <button class="btn toolbar-btn toolbar-more" type="button" onclick="WaterFuel.toggleMoreMenu(event)">☰ المزيد</button>
        <div id="heroMoreMenu" class="more-menu">${moreItems}</div>
      </div>
    `;
  }

  function normalizeFuelKpis() {
    const cards = [...document.querySelectorAll('.kpi-card, .kpi-wide')];
    for (const card of cards) {
      const text = card.textContent || '';
      const span = card.querySelector('span');
      const small = card.querySelector('small');
      if (/إجمالي السولار المستلم|سولار مستلم|وقود وارد/.test(text)) {
        if (span) span.textContent = 'وقود وارد';
        if (small) small.textContent = 'من سجل الوقود الوارد';
        card.classList.add('fuel-incoming-kpi');
      }
      if (/وقود مستهلك|إجمالي السولار المستهلك|وقود مستخدم/.test(text)) {
        if (span) span.textContent = 'وقود مستخدم';
        if (small) small.textContent = 'من استهلاك التقارير اليومية';
        card.classList.add('fuel-used-kpi');
      }
      if (/السولار في المخزون|آخر رصيد|وقود متبقي/.test(text)) {
        if (span) span.textContent = 'وقود متبقي';
        if (small) small.textContent = 'الوارد - المستخدم';
        card.classList.add('fuel-remaining-kpi');
      }
    }
  }

  function hideLegacyExportButtons() {
    document.querySelectorAll('.report-actions-panel button').forEach(button => {
      const text = button.textContent || '';
      if (text.includes('تصدير PDF') || text.includes('تصدير Excel')) {
        button.classList.add('old-export-hidden');
        button.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function addBuildBadge() {
    if (document.getElementById('productionBuildBadge')) return;
    const badge = document.createElement('div');
    badge.id = 'productionBuildBadge';
    badge.className = 'production-build-badge';
    badge.textContent = `نسخة الإنتاج: ${BUILD_ID}`;
    document.body.appendChild(badge);
  }

  function patch() {
    buildHeroToolbar();
    normalizeFuelKpis();
    hideLegacyExportButtons();
    addBuildBadge();
    window.WaterVersionGuard?.releaseBootLock?.();
  }

  let scheduled = false;
  function schedulePatch() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      patch();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedulePatch);
  } else {
    schedulePatch();
  }

  new MutationObserver(schedulePatch).observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(schedulePatch, 600);
  setTimeout(schedulePatch, 1800);
  setTimeout(schedulePatch, 4200);

  window.WaterProductionSync = { BUILD_ID, patch };
})();
