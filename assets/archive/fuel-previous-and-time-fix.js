(() => {
  function n(value) {
    return window.ReportUtils?.number ? window.ReportUtils.number(value) : Number(value || 0) || 0;
  }

  function latestFuelBalanceReport() {
    return [...(window.__WATER_REPORTS_CACHE__ || [])]
      .filter(report => n(report?.fuel?.currentBalance))
      .sort((a, b) => String(b.reportDate || '').localeCompare(String(a.reportDate || '')))[0] || null;
  }

  function applyPreviousFuelBalance() {
    const form = document.getElementById('reportForm');
    if (!form) return;

    const previousInput = form.querySelector('[name="fuelPrevious"]');
    if (!previousInput || previousInput.value || previousInput.dataset.autoPreviousApplied === 'true') return;

    const latest = latestFuelBalanceReport();
    const latestBalance = n(latest?.fuel?.currentBalance);
    if (!latestBalance) return;

    previousInput.value = Number.isInteger(latestBalance) ? String(latestBalance) : String(+latestBalance.toFixed(2));
    previousInput.dataset.autoCalculated = 'true';
    previousInput.dataset.autoPreviousApplied = 'true';
    previousInput.classList.add('live-updated');
    setTimeout(() => previousInput.classList.remove('live-updated'), 700);

    const label = previousInput.closest('label');
    if (label && !label.querySelector('.fuel-previous-note')) {
      const date = latest?.reportDate && window.ReportUtils?.displayDate ? window.ReportUtils.displayDate(latest.reportDate) : 'آخر تقرير';
      label.insertAdjacentHTML('beforeend', `<small class="fuel-previous-note">تم جلبه تلقائيًا من رصيد آخر تقرير: ${date}</small>`);
    }

    window.LiveCalculations?.runAll?.(form, 'fuelPrevious');
  }

  function observeFuelPrevious() {
    applyPreviousFuelBalance();
    const observer = new MutationObserver(() => applyPreviousFuelBalance());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.FuelPreviousPatch = { apply: applyPreviousFuelBalance };
  window.addEventListener('DOMContentLoaded', observeFuelPrevious);
})();
