(() => {
  const FUEL_CONSUMPTION_PER_HOUR = 19;

  function num(value) {
    const n = window.ReportUtils?.number
      ? window.ReportUtils.number(value)
      : Number(String(value || '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  function hoursToDecimal(value) {
    if (!value) return 0;
    const [h, m = 0] = String(value).split(':').map(Number);
    return (Number(h) || 0) + ((Number(m) || 0) / 60);
  }

  function cleanNumber(value) {
    if (!Number.isFinite(value)) return '';
    return Number.isInteger(value) ? String(value) : String(+value.toFixed(2));
  }

  function get(form, name) {
    return form?.querySelector(`[name="${name}"]`)?.value || '';
  }

  function set(form, name, value, auto = true) {
    const input = form?.querySelector(`[name="${name}"]`);
    if (!input) return;
    const next = value === 0 ? '0' : String(value || '');
    if (input.value === next) return;
    input.value = next;
    if (auto) input.dataset.autoCalculated = 'true';
    input.classList.add('live-updated');
    setTimeout(() => input.classList.remove('live-updated'), 500);
  }

  function shouldAutoFill(input, force = false) {
    if (!input) return false;
    if (input.dataset.autoCalculated === 'false') return false;
    return force || !input.value || input.dataset.autoCalculated === 'true' || input.readOnly;
  }

  function beneficiaryTotals(form) {
    const quantityInputs = [...form.querySelectorAll('[data-b="quantity"]')];
    const carInputs = [...form.querySelectorAll('[data-b="cars"]')];
    return {
      filled: quantityInputs.reduce((sum, input) => sum + num(input.value), 0),
      cars: carInputs.reduce((sum, input) => sum + num(input.value), 0)
    };
  }

  function calculateTimeAndWater(form, changedName = '') {
    const start = get(form, 'generatorStart');
    const end = get(form, 'generatorEnd');
    const runHoursInput = form.querySelector('[name="totalRunHours"]');
    const timeChanged = ['generatorStart', 'generatorEnd'].includes(changedName);
    const waterSourceChanged = ['generatorStart', 'generatorEnd', 'totalRunHours', 'submersibleRate', 'filteredRate'].includes(changedName);

    if (start && end && window.ReportUtils?.calcRunHours && shouldAutoFill(runHoursInput, timeChanged)) {
      set(form, 'totalRunHours', window.ReportUtils.calcRunHours(start, end));
    }

    const runHours = hoursToDecimal(get(form, 'totalRunHours'));
    const submersibleRate = num(get(form, 'submersibleRate'));
    const filteredRate = num(get(form, 'filteredRate'));
    const dailyProductionInput = form.querySelector('[name="dailyProduction"]');
    const rejectWaterInput = form.querySelector('[name="rejectWater"]');
    const lossInput = form.querySelector('[name="lossPercentage"]');

    if (runHours && filteredRate && shouldAutoFill(dailyProductionInput, waterSourceChanged)) {
      set(form, 'dailyProduction', cleanNumber(filteredRate * runHours));
    }

    if (runHours && submersibleRate && filteredRate && shouldAutoFill(rejectWaterInput, waterSourceChanged)) {
      set(form, 'rejectWater', cleanNumber((submersibleRate - filteredRate) * runHours));
    }

    const dailyProduction = num(get(form, 'dailyProduction'));
    const rejectWater = num(get(form, 'rejectWater'));
    if (dailyProduction && rejectWater && shouldAutoFill(lossInput, waterSourceChanged || changedName === 'dailyProduction' || changedName === 'rejectWater')) {
      set(form, 'lossPercentage', cleanNumber((rejectWater / dailyProduction) * 100));
    }

    const totals = beneficiaryTotals(form);
    set(form, 'filledWater', cleanNumber(totals.filled));
    set(form, 'carsCount', cleanNumber(totals.cars));
    set(form, 'averagePerCar', totals.cars ? cleanNumber(totals.filled / totals.cars) : '');
  }

  function calculateFuel(form, changedName = '') {
    const runHours = hoursToDecimal(get(form, 'totalRunHours'));
    const consumedInput = form.querySelector('[name="fuelConsumed"]');
    const fuelSourceChanged = ['generatorStart', 'generatorEnd', 'totalRunHours'].includes(changedName);
    const fuelBalanceChanged = ['fuelPrevious', 'fuelAdded', 'fuelMunicipal', 'fuelConsumed'].includes(changedName) || fuelSourceChanged;

    if (runHours && shouldAutoFill(consumedInput, fuelSourceChanged) && changedName !== 'fuelConsumed') {
      set(form, 'fuelConsumed', cleanNumber(runHours * FUEL_CONSUMPTION_PER_HOUR));
    }

    const previous = num(get(form, 'fuelPrevious'));
    const added = num(get(form, 'fuelAdded'));
    const municipal = num(get(form, 'fuelMunicipal'));
    const consumed = num(get(form, 'fuelConsumed'));
    const currentInput = form.querySelector('[name="fuelCurrent"]');
    const lossInput = form.querySelector('[name="fuelLoss"]');

    const hasAnyFuel = previous || added || municipal || consumed || num(get(form, 'fuelCurrent'));
    if (!hasAnyFuel) return;

    const expectedCurrent = previous + added + municipal - consumed;

    if (shouldAutoFill(currentInput, fuelBalanceChanged) && changedName !== 'fuelCurrent') {
      set(form, 'fuelCurrent', cleanNumber(expectedCurrent));
    }

    const current = num(get(form, 'fuelCurrent'));
    if ((current || current === 0) && shouldAutoFill(lossInput, fuelBalanceChanged || changedName === 'fuelCurrent') && changedName !== 'fuelLoss') {
      set(form, 'fuelLoss', cleanNumber(expectedCurrent - current));
    }
  }

  function runAll(form, changedName = '') {
    if (!form) return;
    calculateTimeAndWater(form, changedName);
    calculateFuel(form, changedName);
  }

  function markManual(event) {
    const input = event.target;
    if (!input?.name || !event.isTrusted) return;
    const autoFields = [
      'totalRunHours',
      'dailyProduction',
      'rejectWater',
      'lossPercentage',
      'filledWater',
      'carsCount',
      'averagePerCar',
      'fuelConsumed',
      'fuelCurrent',
      'fuelLoss'
    ];
    if (autoFields.includes(input.name)) {
      input.dataset.autoCalculated = 'false';
    }
  }

  function bindLiveCalculations() {
    const form = document.getElementById('reportForm');
    if (!form || form.dataset.liveCalculationsBound === 'true') return;
    form.dataset.liveCalculationsBound = 'true';

    form.addEventListener('input', event => {
      markManual(event);
      runAll(form, event.target?.name || '');
    });

    form.addEventListener('change', event => {
      markManual(event);
      runAll(form, event.target?.name || '');
    });

    form.addEventListener('focusout', event => {
      runAll(form, event.target?.name || '');
    });

    runAll(form);
  }

  function observeForms() {
    bindLiveCalculations();
    const observer = new MutationObserver(() => bindLiveCalculations());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.LiveCalculations = { bind: bindLiveCalculations, runAll, fuelRate: FUEL_CONSUMPTION_PER_HOUR };
  window.addEventListener('DOMContentLoaded', observeForms);
})();
