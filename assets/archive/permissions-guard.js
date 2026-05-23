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
