(() => {
  const EXTERNAL_WATER_RE = /مياه خارجية|صنابير للمواطنين|خارج المحطة/;

  function number(value) {
    if (window.ReportUtils?.number) return window.ReportUtils.number(value);
    const n = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  function cleanNumber(value, digits = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return value === 0 ? 0 : '';
    const rounded = +n.toFixed(digits);
    return Number.isInteger(rounded) ? rounded : rounded;
  }

  function isExternalWater(name) {
    return EXTERNAL_WATER_RE.test(String(name || ''));
  }

  function cleanBeneficiaries(report) {
    const next = structuredClone(report || {});
    next.beneficiaries = Array.isArray(next.beneficiaries) ? next.beneficiaries.map(item => {
      if (!isExternalWater(item.name)) return item;
      return { ...item, cars: '0' };
    }) : [];
    return next;
  }

  function cleanReport(report) {
    const r = cleanBeneficiaries(report || {});
    r.fuel = r.fuel || {};
    const prev = number(r.fuel.previousBalance);
    const added = number(r.fuel.addedDaily);
    const municipal = number(r.fuel.municipalSupplied);
    const current = number(r.fuel.currentBalance);

    // لا نعرض ولا نعتمد رصيدًا سالبًا ناتجًا عن تقرير ناقص أو بدون رصيد سابق.
    if (prev < 0) r.fuel.previousBalance = '';
    if (current < 0 && !prev && !added && !municipal) {
      r.fuel.currentBalance = '';
      r.fuel.loss = '';
    }
    return r;
  }

  function patchReportUtils() {
    if (!window.ReportUtils || window.ReportUtils.__stableCleanupPatched) return;
    const originalRecalc = window.ReportUtils.recalc;
    const originalSummary = window.ReportUtils.summary;

    window.ReportUtils.recalc = function stableRecalc(report) {
      const r = originalRecalc(cleanReport(report));
      r.fuel = r.fuel || {};
      r.water = r.water || {};

      ['addedDaily', 'consumedDaily', 'municipalSupplied', 'previousBalance', 'currentBalance', 'loss'].forEach(key => {
        if (r.fuel[key] !== '' && r.fuel[key] != null) r.fuel[key] = cleanNumber(number(r.fuel[key]));
      });
      ['submersibleRate', 'filteredRate', 'dailyProduction', 'rejectWater', 'lossPercentage', 'filledWater', 'carsCount', 'averagePerCar'].forEach(key => {
        if (r.water[key] !== '' && r.water[key] != null) r.water[key] = cleanNumber(number(r.water[key]));
      });

      r.beneficiaries = (r.beneficiaries || []).map(item => isExternalWater(item.name) ? { ...item, cars: '0' } : item);
      r.warnings = (r.warnings || []).filter(w => !(String(w).includes('بعض الجهات') && r.beneficiaries.every(item => !isExternalWater(item.name) || String(item.cars) === '0')));
      return r;
    };

    window.ReportUtils.summary = function stableSummary(reports) {
      const s = originalSummary((reports || []).map(cleanReport));
      return Object.fromEntries(Object.entries(s).map(([key, value]) => [key, typeof value === 'number' ? cleanNumber(value) : value]));
    };

    window.ReportUtils.__stableCleanupPatched = true;
  }

  function patchLayout() {
    if (!window.AppUI || window.AppUI.__stableLayoutPatched) return;
    const previousLayout = window.AppUI.layout;
    window.AppUI.layout = function stableLayout(state, settings) {
      const cleanState = {
        ...state,
        reports: (state?.reports || []).map(report => window.ReportUtils?.recalc ? window.ReportUtils.recalc(report) : cleanReport(report))
      };
      return previousLayout(cleanState, settings);
    };
    window.AppUI.__stableLayoutPatched = true;
  }

  function fixExternalWaterRows() {
    document.querySelectorAll('#beneficiariesRows tr').forEach(row => {
      const name = row.querySelector('[data-b="name"]')?.value || '';
      const cars = row.querySelector('[data-b="cars"]');
      if (!cars) return;
      if (isExternalWater(name)) {
        cars.value = '0';
        cars.readOnly = true;
        row.classList.add('external-water-row');
        const cell = cars.closest('td');
        if (cell && !cell.querySelector('.external-water-note')) {
          cell.insertAdjacentHTML('beforeend', '<span class="external-water-note">لا يوجد سيارات</span>');
        }
      }
    });
  }

  function moveReportActionsToTop() {
    const modal = document.getElementById('reportModal');
    if (!modal?.classList.contains('open')) return;
    const panel = modal.querySelector('.modal-panel.large');
    const title = modal.querySelector('.modal-title');
    const actions = modal.querySelector('.modal-actions');
    if (!panel || !title || !actions || actions.dataset.movedTop === 'true') return;
    title.insertAdjacentElement('afterend', actions);
    actions.dataset.movedTop = 'true';
  }

  function fixLiveFuelBalance() {
    const form = document.getElementById('reportForm');
    if (!form) return;
    const current = form.querySelector('[name="fuelCurrent"]');
    const loss = form.querySelector('[name="fuelLoss"]');
    const prev = number(form.querySelector('[name="fuelPrevious"]')?.value);
    const added = number(form.querySelector('[name="fuelAdded"]')?.value);
    const municipal = number(form.querySelector('[name="fuelMunicipal"]')?.value);
    const currentVal = number(current?.value);
    if (current && currentVal < 0 && !prev && !added && !municipal) {
      current.value = '';
      current.dataset.autoCalculated = 'true';
      if (loss) loss.value = '';
    }
  }

  function applyDomCleanup() {
    moveReportActionsToTop();
    fixExternalWaterRows();
    fixLiveFuelBalance();
  }

  function patchAll() {
    patchReportUtils();
    patchLayout();
    applyDomCleanup();
  }

  patchAll();
  window.addEventListener('DOMContentLoaded', () => {
    patchAll();
    const observer = new MutationObserver(applyDomCleanup);
    observer.observe(document.body, { childList: true, subtree: true });
    document.body.addEventListener('input', applyDomCleanup, true);
    document.body.addEventListener('change', applyDomCleanup, true);
  });
})();
