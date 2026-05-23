(() => {
  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function getReport(id) {
    return (window.__WATER_REPORTS_CACHE__ || []).find(item => item.id === id);
  }

  function normalizeSkipped(report) {
    return Array.isArray(report?.skippedWarnings) ? report.skippedWarnings : [];
  }

  function isSkipped(report, message) {
    return normalizeSkipped(report).includes(message);
  }

  function visibleWarnings(report) {
    const base = window.ReportUtils?.recalc ? window.ReportUtils.recalc({ ...report, skippedWarnings: [] }) : report;
    const skipped = normalizeSkipped(report);
    return (base.warnings || []).filter(message => !skipped.includes(message));
  }

  function severityOf(message) {
    const text = String(message || '');
    if (text.includes('أكبر من الإنتاج') || text.includes('رصيد الوقود')) return 'danger';
    if (text.includes('معدّل يدويًا') || text.includes('لا يطابق')) return 'medium';
    return 'soft';
  }

  function renderWarnings(report) {
    const list = visibleWarnings(report);
    if (!list.length) return '';
    return `<div class="smart-warnings skip-enabled-warnings">${list.map(message => {
      const severity = severityOf(message);
      const isWater = message.includes('المياه المعبأة') || message.includes('الإنتاج');
      const isBeneficiaries = message.includes('الجهات');
      return `<div class="smart-warning ${severity}"><p>${esc(message)}</p><div class="single-warning-actions">${isWater ? `<button class="btn primary" onclick="WarningSkipActions.openWaterFix('${report.id}')">تعديل سريع</button>` : ''}${isBeneficiaries ? `<button class="btn" onclick="WarningSkipActions.openBeneficiaryFix('${report.id}')">تعديل الجهات</button>` : ''}<button class="btn ghost skip-warning-btn" onclick="WarningSkipActions.skip('${report.id}', '${esc(message).replace(/'/g, '&#039;')}')">تخطي هذا التنبيه</button></div></div>`;
    }).join('')}</div>`;
  }

  async function skip(id, message) {
    const report = getReport(id);
    if (!report) return alert('تعذر العثور على التقرير. أعد تحميل الصفحة.');
    const text = String(message || '').replace(/&#039;/g, "'");
    const skipped = [...new Set([...normalizeSkipped(report), text])];
    const next = { ...report, skippedWarnings: skipped };
    if (window.ReportUtils?.recalc) next.warnings = window.ReportUtils.recalc(next).warnings;
    await window.FirebaseService.saveReport(next, window.firebase?.auth?.().currentUser || null, id);
  }

  async function unskipAll(id) {
    const report = getReport(id);
    if (!report) return;
    const next = { ...report, skippedWarnings: [] };
    if (window.ReportUtils?.recalc) next.warnings = window.ReportUtils.recalc(next).warnings;
    await window.FirebaseService.saveReport(next, window.firebase?.auth?.().currentUser || null, id);
  }

  function patchReportUtils() {
    if (!window.ReportUtils || window.ReportUtils.__skipWarningsPatched) return;
    const originalRecalc = window.ReportUtils.recalc;
    window.ReportUtils.recalc = function patchedRecalc(report) {
      const r = originalRecalc(report);
      const skipped = normalizeSkipped(report || r);
      r.skippedWarnings = skipped;
      if (Array.isArray(r.warnings) && skipped.length) {
        r.warnings = r.warnings.filter(message => !skipped.includes(message));
      }
      return r;
    };
    window.ReportUtils.__skipWarningsPatched = true;
  }

  function patchLayout() {
    if (!window.AppUI || window.AppUI.__skipWarningsLayoutPatched) return;
    const previousLayout = window.AppUI.layout;
    window.AppUI.layout = function patchedSkipWarningsLayout(state, settings) {
      const reports = state?.reports || [];
      const active = reports.find(r => r.id === state.currentId) || null;
      let html = previousLayout(state, settings);
      if (!active) return html;
      const replacement = renderWarnings(active);
      if (html.includes('smart-warnings')) {
        html = html.replace(/<div class="smart-warnings[\s\S]*?<\/div>\s*<\/div>/, replacement);
      } else if (replacement) {
        html = html.replace('<div class="detail-grid">', `${replacement}<div class="detail-grid">`);
      }
      const skippedCount = normalizeSkipped(active).length;
      if (skippedCount && html.includes('<div class="detail-grid">')) {
        const restore = `<div class="skipped-warning-note"><span>تم تخطي ${skippedCount} تنبيه في هذا التقرير.</span><button class="btn ghost" onclick="WarningSkipActions.unskipAll('${active.id}')">إظهار التنبيهات المخفية</button></div>`;
        html = html.replace('<div class="detail-grid">', `${restore}<div class="detail-grid">`);
      }
      return html;
    };
    window.AppUI.__skipWarningsLayoutPatched = true;
  }

  function patchAll() {
    patchReportUtils();
    patchLayout();
  }

  window.WarningSkipActions = {
    skip,
    unskipAll,
    visibleWarnings,
    renderWarnings,
    openWaterFix: id => window.WarningActions?.openWaterFix?.(id),
    openBeneficiaryFix: id => window.WarningActions?.openBeneficiaryFix?.(id)
  };

  patchAll();
  window.addEventListener('DOMContentLoaded', patchAll);
})();
