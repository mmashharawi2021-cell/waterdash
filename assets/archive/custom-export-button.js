(() => {
  function openCustomExport() {
    if (!window.WaterFuel?.openExportCenter) {
      alert('مركز التصدير لم يكتمل تحميله. أعد تحميل الصفحة.');
      return;
    }
    window.WaterFuel.openExportCenter();
    setTimeout(() => {
      try {
        window.WaterFuel.setExportType?.('customReport');
        const section = document.getElementById('exportCenterSection');
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (error) {
        console.warn('Could not preselect custom report export', error);
      }
    }, 120);
  }

  function ensureCustomExportButton() {
    const heroActions = document.querySelector('.hero-actions');
    if (!heroActions) return;
    if (document.getElementById('customReportExportBtn')) return;

    const button = document.createElement('button');
    button.id = 'customReportExportBtn';
    button.type = 'button';
    button.className = 'btn toolbar-btn toolbar-custom-export';
    button.innerHTML = '🧾 تصدير مخصص';
    button.addEventListener('click', openCustomExport);

    const moreWrap = heroActions.querySelector('.more-menu-wrap');
    if (moreWrap) heroActions.insertBefore(button, moreWrap);
    else heroActions.appendChild(button);
  }

  function ensureCustomMenuItem() {
    const menu = document.getElementById('heroMoreMenu');
    if (!menu || document.getElementById('customReportExportMenuItem')) return;
    const button = document.createElement('button');
    button.id = 'customReportExportMenuItem';
    button.type = 'button';
    button.className = 'btn toolbar-btn more-item toolbar-custom-export-menu';
    button.innerHTML = '🧾 تصدير التقارير المخصص';
    button.addEventListener('click', openCustomExport);
    menu.prepend(button);
  }

  function boot() {
    ensureCustomExportButton();
    ensureCustomMenuItem();
  }

  window.CustomReportExport = { boot, openCustomExport };
  window.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', boot);
  setTimeout(boot, 400);
  setTimeout(boot, 1200);
  setInterval(boot, 1800);
})();
