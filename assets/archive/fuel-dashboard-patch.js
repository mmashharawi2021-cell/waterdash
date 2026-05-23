(() => {
  let lastReports = [];

  function n(value) {
    return window.ReportUtils?.number ? window.ReportUtils.number(value) : Number(value || 0) || 0;
  }

  function format(value) {
    const x = n(value);
    if (!x) return '_';
    return Number.isInteger(x) ? String(x) : String(+x.toFixed(2));
  }

  function uniqueIncomingEntries() {
    const raw = Array.isArray(window.WaterFuelRawEntries) ? window.WaterFuelRawEntries : [];
    const seen = new Set();
    const unique = [];
    raw.forEach(item => {
      const key = [item.date || '', item.time || '', item.supplier || item.donor || '', item.quantityLiters ?? item.quantity ?? '', item.fillingMethod || '', item.deliveredBy || ''].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(item);
    });
    return unique;
  }

  function totalIncomingFuel() {
    return uniqueIncomingEntries().reduce((sum, item) => sum + n(item.quantityLiters ?? item.quantity), 0);
  }

  function totalConsumed(reports) {
    return (reports || []).reduce((sum, r) => sum + n(r?.fuel?.consumedDaily), 0);
  }

  function remainingFuel(reports) {
    return totalIncomingFuel() - totalConsumed(reports);
  }

  function fuelKpiCards(reports) {
    const incoming = totalIncomingFuel();
    const consumed = totalConsumed(reports);
    const remaining = incoming - consumed;

    return `
      <article class="kpi-card fuel-kpi fuel-incoming-kpi">
        <div class="kpi-icon">⛽</div>
        <span>وقود وارد</span>
        <strong>${format(incoming)}</strong>
        <small>من زر إضافة وقود وارد</small>
      </article>
      <article class="kpi-card fuel-kpi fuel-consumed-kpi">
        <div class="kpi-icon">🔥</div>
        <span>وقود مستخدم</span>
        <strong>${format(consumed)}</strong>
        <small>من استهلاك التقارير اليومية</small>
      </article>
      <article class="kpi-card fuel-kpi fuel-remaining-kpi">
        <div class="kpi-icon">📦</div>
        <span>وقود متبقي</span>
        <strong>${format(remaining)}</strong>
        <small>الوارد - المستخدم</small>
      </article>`;
  }

  function updateFuelKpiDom() {
    const incoming = totalIncomingFuel();
    const consumed = totalConsumed(lastReports);
    const remaining = incoming - consumed;
    const updates = [
      ['.fuel-incoming-kpi', incoming, 'من زر إضافة وقود وارد'],
      ['.fuel-consumed-kpi', consumed, 'من استهلاك التقارير اليومية'],
      ['.fuel-remaining-kpi', remaining, 'الوارد - المستخدم']
    ];
    updates.forEach(([selector, value, hint]) => {
      const card = document.querySelector(selector);
      if (!card) return;
      const strong = card.querySelector('strong');
      const small = card.querySelector('small');
      if (strong) strong.textContent = format(value);
      if (small) small.textContent = hint;
    });
  }

  function scheduleFuelKpiRefresh() {
    setTimeout(updateFuelKpiDom, 350);
    setTimeout(updateFuelKpiDom, 1500);
  }

  function addFuelToReportCards(html, reports) {
    let index = 0;
    return html.replace(/<button class="report-card[\s\S]*?<\/button>/g, cardHtml => {
      const report = reports[index++];
      if (!report) return cardHtml;
      const consumed = format(report?.fuel?.consumedDaily);
      const fuelStrip = `<div class="fuel-card-strip"><span>🔥 مستخدم: ${consumed} لتر</span></div>`;
      return cardHtml.replace('</button>', `${fuelStrip}</button>`);
    });
  }

  function addFuelToDetails(html, active) {
    if (!active) return html;
    const consumed = format(active?.fuel?.consumedDaily);
    const extra = `<article><span>وقود مستخدم في التقرير</span><strong>${consumed} لتر</strong></article>`;
    return html.replace(/(<div class="detail-grid">[\s\S]*?)(<\/div><section class="tests-summary">)/, `$1${extra}$2`);
  }

  function patchLayout() {
    if (!window.AppUI || window.AppUI.__fuelDashboardPatched) return;
    const originalLayout = window.AppUI.layout;
    window.AppUI.layout = function patchedFuelLayout(state, settings) {
      const reports = state?.reports || [];
      lastReports = reports;
      const active = reports.find(r => r.id === state.currentId) || null;
      let html = originalLayout(state, settings);

      html = html.replace('</section><section id="reports"', `${fuelKpiCards(reports)}</section><section id="reports"`);
      html = addFuelToReportCards(html, reports);
      html = addFuelToDetails(html, active);
      scheduleFuelKpiRefresh();
      return html;
    };
    window.AppUI.__fuelDashboardPatched = true;
  }

  patchLayout();
  window.addEventListener('DOMContentLoaded', () => {
    patchLayout();
    scheduleFuelKpiRefresh();
  });
  window.addEventListener('load', scheduleFuelKpiRefresh);
})();
