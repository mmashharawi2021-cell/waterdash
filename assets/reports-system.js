/* --- Unified Module: reports-system.js --- */

/* ==========================================
   Authoritative Report Utilities & Calculations Engine
   ========================================== */
window.ReportUtils = (() => {
  const digitMap = {
    '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
    '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'
  };

  const EXTERNAL_WATER_RE = /مياه خارجية|صنابير للمواطنين|خارج المحطة/;

  function normalizeDigits(value) {
    return String(value ?? '').replace(/[٠-٩۰-۹]/g, d => digitMap[d] || d);
  }

  function number(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    let s = normalizeDigits(value).trim();
    s = s.replace(/[\u066B٫]/g, '.');
    s = s.replace(/[\u066C]/g, '');
    if (s.includes(',') && s.includes('.')) {
      s = s.replace(/,/g, '');
    } else if ((s.match(/,/g) || []).length > 1) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
    const n = Number(s.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function round(value, decimals = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    const factor = Math.pow(10, decimals);
    const r = Math.round((n + Number.EPSILON) * factor) / factor;
    return Number.isInteger(r) ? r : +r.toFixed(decimals);
  }

  function isExternalWater(name) {
    return EXTERNAL_WATER_RE.test(String(name || ''));
  }

  function normalizeDateInput(value) {
    const raw = normalizeDigits(value).trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    let m = raw.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (m) {
      const year = m[1];
      const month = String(Number(m[2])).padStart(2, '0');
      const day = String(Number(m[3])).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (!m) return raw;
    const day = String(Number(m[1])).padStart(2, '0');
    const month = String(Number(m[2])).padStart(2, '0');
    const year = m[3];
    return `${year}-${month}-${day}`;
  }

  function displayDate(date) {
    const iso = normalizeDateInput(date);
    const parts = String(iso || '').split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : (date || '');
  }

  function normalizeTimeInput(value) {
    let raw = normalizeDigits(value).trim().toLowerCase();
    if (!raw) return '';

    const isPm = /(م|مساء|pm|p\.m)/i.test(raw);
    const isAm = /(ص|صباح|am|a\.m)/i.test(raw);
    raw = raw.replace(/[صم]/g, '').replace(/صباحاً|صباحا|صباح|مساءً|مساءا|مساء|am|pm|a\.m|p\.m/gi, '').trim();
    raw = raw.replace(/[٫،.]/g, ':').replace(/\s+/g, '');

    const match = raw.match(/(\d{1,2})(?::(\d{1,2}))?/);
    if (!match) return String(value || '');

    let h = Number(match[1]);
    let m = Number(match[2] || 0);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return String(value || '');
    if (m > 59) m = 59;

    if (isPm && h < 12) h += 12;
    if (isAm && h === 12) h = 0;
    if (h > 23) h = h % 24;

    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function displayTimeArabic(value) {
    const normalized = normalizeTimeInput(value);
    const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return value || '';
    let h = Number(match[1]);
    const m = match[2];
    const suffix = h >= 12 ? 'م' : 'ص';
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}:${m} ${suffix}`;
  }

  function timeToMinutes(value) {
    const normalized = normalizeTimeInput(value);
    const [h, m] = normalized.split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
  }

  function minutesToHours(minutes) {
    if (!minutes && minutes !== 0) return '';
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
  }

  function calcRunHours(start, stop) {
    if (!start || !stop) return '';
    let s = timeToMinutes(start);
    let e = timeToMinutes(stop);
    if (!s && !e) return '';
    if (e < s) e += 1440;
    return minutesToHours(e - s);
  }

  function hoursToDecimal(hours) {
    if (!hours) return 0;
    const [h, m = 0] = String(hours).split(':').map(Number);
    return (Number(h) || 0) + ((Number(m) || 0) / 60);
  }

  function emptyReport() {
    const today = new Date().toISOString().slice(0, 10);
    const defaultSettings = window.WATER_APP_SETTINGS || {};
    return {
      title: `تقرير تشغيل وضخ المياه ${displayDate(today)}`,
      reportDate: today,
      stationName: defaultSettings.defaultStationName || 'المحطة الرئيسية',
      wellName: defaultSettings.defaultWellName || 'بئر واحد',
      operatorName: '',
      generalNotes: '',
      generator: {
        periods: [{ startTime: '', stopTime: '', runHours: '' }],
        totalRunHours: '',
        status: 'يعمل',
        operatorName: '',
        notes: '',
        extraFields: []
      },
      fuel: {
        addedDaily: '',
        consumedDaily: '',
        municipalSupplied: '',
        previousBalance: '',
        currentBalance: '',
        loss: '',
        notes: '',
        extraFields: []
      },
      water: {
        dailyProduction: '',
        rejectWater: '',
        lossPercentage: '',
        recoveryRate: '',
        rejectRatePercentage: '',
        totalInputWater: '',
        totalInputRate: '',
        filledWater: '',
        carsCount: '',
        averagePerCar: '',
        notes: '',
        filteredRate: defaultSettings.filteredRate || '',
        submersibleRate: defaultSettings.submersibleRate || ''
      },
      tests: {
        phAfterDesalination: '',
        phWellWater: '',
        tdsDesalinated: '',
        tdsWell: '',
        tdsReject: '',
        freeChlorine: defaultSettings.freeChlorine || '',
        extraFields: []
      },
      beneficiaries: [],
      notes: '',
      sourceText: '',
      warnings: [],
      skippedWarnings: []
    };
  }

  function recalc(report) {
    const base = emptyReport();
    const r = structuredClone(report || base);
    r.reportDate = normalizeDateInput(r.reportDate || '');
    r.generator = { ...base.generator, ...(r.generator || {}) };
    r.fuel = { ...base.fuel, ...(r.fuel || {}) };
    r.water = { ...base.water, ...(r.water || {}) };
    r.tests = { ...base.tests, ...(r.tests || {}) };
    r.beneficiaries = Array.isArray(r.beneficiaries) ? r.beneficiaries : [];
    const skippedWarnings = Array.isArray(r.skippedWarnings) ? r.skippedWarnings : [];

    // Generator calculations
    const periods = Array.isArray(r.generator.periods) ? r.generator.periods : [];
    let totalMinutes = 0;
    periods.forEach(period => {
      period.startTime = normalizeTimeInput(period.startTime || '');
      period.stopTime = normalizeTimeInput(period.stopTime || '');
      if (!period.runHours) period.runHours = calcRunHours(period.startTime, period.stopTime);
      const [h, m = 0] = String(period.runHours || '').split(':').map(Number);
      totalMinutes += (Number(h) || 0) * 60 + (Number(m) || 0);
    });
    r.generator.periods = periods;
    r.generator.totalRunHours = r.generator.totalRunHours || minutesToHours(totalMinutes);

    // Beneficiaries calculations
    r.beneficiaries = r.beneficiaries.map(item => isExternalWater(item.name) ? { ...item, cars: 0 } : item);
    const beneficiariesFilled = r.beneficiaries.reduce((sum, item) => sum + number(item.quantity), 0);
    const beneficiariesCars = r.beneficiaries.reduce((sum, item) => sum + number(item.cars), 0);
    const manualFilled = number(r.water.manualFilledWater);

    r.water.filledWater = round(manualFilled || beneficiariesFilled);
    r.water.carsCount = round(beneficiariesCars);
    r.water.averagePerCar = number(r.water.carsCount) ? round(number(r.water.filledWater) / number(r.water.carsCount)) : '';

    // Water flow calculations
    const runHoursDecimal = hoursToDecimal(r.generator.totalRunHours);
    const filteredRate = number(r.water.filteredRate);
    const submersibleRate = number(r.water.submersibleRate);

    if (!number(r.water.dailyProduction) && filteredRate && runHoursDecimal) {
      r.water.dailyProduction = round(filteredRate * runHoursDecimal);
    }
    if (!number(r.water.rejectWater) && submersibleRate && filteredRate && runHoursDecimal) {
      r.water.rejectWater = round((submersibleRate - filteredRate) * runHoursDecimal);
    }

    const dailyProduction = number(r.water.dailyProduction);
    const rejectWater = number(r.water.rejectWater);
    const totalInput = round(dailyProduction + rejectWater);

    if (totalInput) {
      r.water.totalInputWater = totalInput;
      r.water.recoveryRate = round((dailyProduction / totalInput) * 100);
      r.water.rejectRatePercentage = round((rejectWater / totalInput) * 100);
    } else if (submersibleRate || filteredRate) {
      const rejectRateHourly = Math.max(submersibleRate - filteredRate, 0);
      const totalRate = submersibleRate || (filteredRate + rejectRateHourly);
      if (totalRate) {
        r.water.recoveryRate = round((filteredRate / totalRate) * 100);
        r.water.rejectRatePercentage = round((rejectRateHourly / totalRate) * 100);
      }
    }
    r.water.totalInputRate = submersibleRate ? round(submersibleRate) : '';

    if (dailyProduction && rejectWater) {
      r.water.lossPercentage = round((rejectWater / dailyProduction) * 100);
    }

    // Fuel calculations
    const fuelRate = Number(window.WATER_APP_SETTINGS?.fuelRate) || 19;
    if (r.fuel.consumedDaily === '' || r.fuel.consumedDaily == null) {
      if (runHoursDecimal > 0) {
        r.fuel.consumedDaily = round(runHoursDecimal * fuelRate);
      }
    } else {
      r.fuel.consumedDaily = number(r.fuel.consumedDaily) ? round(number(r.fuel.consumedDaily)) : r.fuel.consumedDaily;
    }

    ['addedDaily', 'municipalSupplied', 'previousBalance', 'currentBalance', 'loss'].forEach(k => {
      if (r.fuel[k] !== '' && r.fuel[k] != null) {
        r.fuel[k] = round(number(r.fuel[k]));
      }
    });

    const prev = number(r.fuel.previousBalance);
    const added = number(r.fuel.addedDaily);
    const municipal = number(r.fuel.municipalSupplied);
    const consumed = number(r.fuel.consumedDaily);
    const current = number(r.fuel.currentBalance);

    if (prev < 0) r.fuel.previousBalance = '';
    if (current < 0 && !prev && !added && !municipal) {
      r.fuel.currentBalance = '';
      r.fuel.loss = '';
    }

    // Build warnings
    const warnings = [];
    if (dailyProduction && number(r.water.filledWater) > dailyProduction) {
      warnings.push('كمية المياه المعبأة أكبر من الإنتاج اليومي المحسوب.');
    }
    if (manualFilled && beneficiariesFilled && Math.abs(manualFilled - beneficiariesFilled) > 0.5) {
      warnings.push('إجمالي المياه المعبأة معدّل يدويًا ولا يطابق مجموع الجهات.');
    }
    if (r.beneficiaries.some(item => !isExternalWater(item.name) && String(item.name || '').trim() && (!number(item.quantity) || !number(item.cars)))) {
      warnings.push('بعض الجهات لديها اسم بدون كمية أو عدد سيارات.');
    }

    const uniqueWarnings = [...new Set(warnings)];
    r.skippedWarnings = skippedWarnings;
    r.warnings = uniqueWarnings.filter(w => !skippedWarnings.includes(w));

    return r;
  }

  function fromParsed(parsed) {
    const base = emptyReport();
    const firstPeriod = {
      startTime: parsed.generatorStart || '',
      stopTime: parsed.generatorEnd || '',
      runHours: parsed.runHours || ''
    };
    const report = {
      ...base,
      title: parsed.title || base.title,
      reportDate: parsed.date || base.reportDate,
      operatorName: parsed.operatorName || '',
      generalNotes: parsed.generalNotes || '',
      generator: {
        ...base.generator,
        periods: [firstPeriod],
        totalRunHours: parsed.runHours || '',
        status: parsed.generatorStatus || 'يعمل',
        operatorName: parsed.operatorName || '',
        notes: parsed.generatorNotes || ''
      },
      fuel: {
        ...base.fuel,
        addedDaily: parsed.fuelAdded || '',
        consumedDaily: parsed.fuelConsumed || '',
        municipalSupplied: parsed.fuelMunicipal || '',
        previousBalance: parsed.previousFuelBalance || '',
        currentBalance: parsed.fuelBalance || '',
        loss: parsed.fuelLoss || '',
        notes: parsed.fuelNotes || ''
      },
      water: {
        ...base.water,
        dailyProduction: parsed.dailyProduction || '',
        rejectWater: parsed.rejectWater || '',
        filledWater: parsed.totalQuantity || '',
        carsCount: parsed.totalCars || '',
        averagePerCar: '',
        notes: parsed.waterNotes || '',
        filteredRate: parsed.filteredRate || '',
        submersibleRate: parsed.submersibleRate || ''
      },
      tests: {
        ...base.tests,
        phAfterDesalination: parsed.phFiltered || '',
        phWellWater: parsed.phWell || '',
        tdsDesalinated: parsed.tdsFiltered || '',
        tdsWell: parsed.tdsWell || '',
        tdsReject: parsed.tdsWaste || '',
        freeChlorine: parsed.chlorine || ''
      },
      beneficiaries: (parsed.beneficiaries || []).map((item, index) => ({
        id: item.id || `b-${Date.now()}-${index}`,
        name: item.name,
        quantity: item.quantity,
        cars: item.cars,
        notes: item.notes || ''
      })),
      sourceText: parsed.sourceText || '',
      warnings: parsed.warnings || []
    };
    return recalc(report);
  }

  function whatsappText(report) {
    const r = recalc(report);
    const beneficiaries = (r.beneficiaries || []).map(item => `▪️ ${item.name}\nالكمية/ ${item.quantity || 0} كوب ، عدد السيارات/ ${item.cars || 0}`).join('\n\n');
    return `*${r.title}*\n\n📅 التاريخ: ${displayDate(r.reportDate)}\n📍 المحطة: ${r.stationName || '-'}\n\n⏱️ تشغيل المولد:\n▪️ البداية: ${displayTimeArabic(r.generator.periods?.[0]?.startTime) || '-'}\n▪️ الإيقاف: ${displayTimeArabic(r.generator.periods?.[0]?.stopTime) || '-'}\n▪️ ساعات التشغيل: ${r.generator.totalRunHours || '-'}\n▪️ الحالة: ${r.generator.status || '-'}\n\n⛽ الوقود:\n▪️ المضاف يومياً: ${r.fuel.addedDaily || '_'} لتر\n▪️ المستهلك يومياً: ${r.fuel.consumedDaily || '_'} لتر\n▪️ المورد من البلدية: ${r.fuel.municipalSupplied || '_'} لتر\n▪️ الرصيد السابق: ${r.fuel.previousBalance || '_'} لتر\n▪️ الرصيد الحالي: ${r.fuel.currentBalance || '_'} لتر\n▪️ الفرق/الفاقد: ${r.fuel.loss || '_'} لتر\n\n💧 كميات المياه:\n▪️ إنتاج الغاطس: ${r.water.submersibleRate || '_'} كوب/ساعة\n▪️ بعد الفلترة: ${r.water.filteredRate || '_'} كوب/ساعة\n▪️ الإنتاج اليومي: ${r.water.dailyProduction || '_'} كوب\n▪️ العادم: ${r.water.rejectWater || '_'} كوب\n▪️ إجمالي المياه الداخلة: ${r.water.totalInputWater || '_'} كوب\n▪️ نسبة الاسترداد: ${r.water.recoveryRate || '_'}%\n▪️ نسبة العادم: ${r.water.rejectRatePercentage || '_'}%\n▪️ نسبة الفاقد: ${r.water.lossPercentage || '_'}%\n▪️ المعبأ للجهات: ${r.water.filledWater || 0} كوب\n▪️ عدد السيارات: ${r.water.carsCount || 0}\n\n🧪 فحوصات المياه:\n▪️ PH بعد التحلية: ${r.tests.phAfterDesalination || '_'}\n▪️ PH مياه الغاطس: ${r.tests.phWellWater || '_'}\n▪️ TDS مياه محلاة: ${r.tests.tdsDesalinated || '_'}\n▪️ TDS بئر: ${r.tests.tdsWell || '_'}\n▪️ TDS عادم: ${r.tests.tdsReject || '_'}\n▪️ الكلور الحر: ${r.tests.freeChlorine || '_'}\n\n🚚 الجهات المستفيدة:\n${beneficiaries || 'لا توجد جهات مدخلة'}\n\n📝 ملاحظات:\n${r.notes || r.generalNotes || '_'}`;
  }

  function summary(reports) {
    const list = reports || [];
    const totals = list.reduce((acc, item) => {
      const r = recalc(item);
      acc.runHours += hoursToDecimal(r.generator.totalRunHours);
      acc.fuelConsumed += number(r.fuel.consumedDaily);
      acc.fuelSupplied += number(r.fuel.municipalSupplied) + number(r.fuel.addedDaily);
      acc.waterProduction += number(r.water.dailyProduction);
      acc.rejectWater += number(r.water.rejectWater);
      acc.filledWater += number(r.water.filledWater);
      acc.cars += number(r.water.carsCount);
      return acc;
    }, { runHours: 0, fuelConsumed: 0, fuelSupplied: 0, waterProduction: 0, rejectWater: 0, filledWater: 0, cars: 0 });

    totals.runHours = round(totals.runHours);
    totals.fuelConsumed = round(totals.fuelConsumed);
    totals.fuelSupplied = round(totals.fuelSupplied);
    totals.waterProduction = round(totals.waterProduction);
    totals.rejectWater = round(totals.rejectWater);
    totals.filledWater = round(totals.filledWater);
    totals.cars = round(totals.cars);

    totals.averageDailyProduction = list.length ? round(totals.waterProduction / list.length) : 0;
    totals.averageFuelConsumption = list.length ? round(totals.fuelConsumed / list.length) : 0;
    totals.lossPercentage = totals.waterProduction ? round((totals.rejectWater / totals.waterProduction) * 100) : 0;
    totals.totalInputWater = round(totals.waterProduction + totals.rejectWater) || 0;
    totals.recoveryRate = totals.totalInputWater ? round((totals.waterProduction / totals.totalInputWater) * 100) : 0;
    totals.rejectRatePercentage = totals.totalInputWater ? round((totals.rejectWater / totals.totalInputWater) * 100) : 0;

    return totals;
  }

  return {
    emptyReport,
    displayDate,
    calcRunHours,
    recalc,
    fromParsed,
    whatsappText,
    summary,
    number,
    round,
    normalizeTimeInput,
    displayTimeArabic,
    normalizeDateInput,
    isExternalWater
  };
})();

/* ==========================================
   Live Calculations Form Controller
   ========================================== */
window.LiveCalculations = (() => {
  const FUEL_CONSUMPTION_PER_HOUR = 19;

  function num(value) {
    return window.ReportUtils.number(value);
  }

  function hoursToDecimal(value) {
    if (!value) return 0;
    const [h, m = 0] = String(value).split(':').map(Number);
    return (Number(h) || 0) + ((Number(m) || 0) / 60);
  }

  function cleanNumber(value) {
    return window.ReportUtils.round(value);
  }

  function get(form, name) {
    return form?.querySelector(`[name="${name}"]`)?.value || '';
  }

  function set(form, name, value, auto = true) {
    const input = form?.querySelector(`[name="${name}"]`);
    if (!input) return;
    const next = value === 0 ? '0' : String(value ?? '');
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

    if (start && end && shouldAutoFill(runHoursInput, timeChanged)) {
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

    if (runHours && shouldAutoFill(rejectWaterInput, waterSourceChanged)) {
      const fixedLoss = Number(window.WATER_APP_SETTINGS?.lossPercentage);
      if (!isNaN(fixedLoss) && fixedLoss > 0 && fixedLoss < 100) {
        const lossFraction = fixedLoss / 100;
        const calcReject = (filteredRate * runHours) * (lossFraction / (1 - lossFraction));
        set(form, 'rejectWater', cleanNumber(calcReject));
      } else if (submersibleRate && filteredRate) {
        set(form, 'rejectWater', cleanNumber((submersibleRate - filteredRate) * runHours));
      }
    }

    const dailyProduction = num(get(form, 'dailyProduction'));
    const rejectWater = num(get(form, 'rejectWater'));
    if (dailyProduction && rejectWater && shouldAutoFill(lossInput, waterSourceChanged || changedName === 'dailyProduction' || changedName === 'rejectWater')) {
      set(form, 'lossPercentage', cleanNumber((rejectWater / dailyProduction) * 100));
    }

    const totalInputWaterInput = form.querySelector('[name="totalInputWater"]');
    const recoveryRateInput = form.querySelector('[name="recoveryRate"]');
    const rejectRatePercentageInput = form.querySelector('[name="rejectRatePercentage"]');

    const totalInput = dailyProduction + rejectWater;
    if (totalInput) {
      if (shouldAutoFill(totalInputWaterInput, waterSourceChanged || changedName === 'dailyProduction' || changedName === 'rejectWater')) {
        set(form, 'totalInputWater', cleanNumber(totalInput));
      }
      if (shouldAutoFill(recoveryRateInput, waterSourceChanged || changedName === 'dailyProduction' || changedName === 'rejectWater')) {
        set(form, 'recoveryRate', cleanNumber((dailyProduction / totalInput) * 100));
      }
      if (shouldAutoFill(rejectRatePercentageInput, waterSourceChanged || changedName === 'dailyProduction' || changedName === 'rejectWater')) {
        set(form, 'rejectRatePercentage', cleanNumber((rejectWater / totalInput) * 100));
      }
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

    const fuelRate = Number(window.WATER_APP_SETTINGS?.fuelRate) || FUEL_CONSUMPTION_PER_HOUR;

    if (runHours && shouldAutoFill(consumedInput, fuelSourceChanged) && changedName !== 'fuelConsumed') {
      set(form, 'fuelConsumed', cleanNumber(runHours * fuelRate));
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

  return { bind: bindLiveCalculations, runAll, fuelRate: FUEL_CONSUMPTION_PER_HOUR };
})();

/* ==========================================
   Data Quality Assurance
   ========================================== */
window.WaterDataQualityPro = (() => {
  function classify(r) {
    const rr = window.ReportUtils.recalc(r);
    let critical = 0, warn = 0;
    const prod = window.ReportUtils.number(rr?.water?.dailyProduction);
    const filled = window.ReportUtils.number(rr?.water?.filledWater);
    const reject = window.ReportUtils.number(rr?.water?.rejectWater);
    const loss = window.ReportUtils.number(rr?.water?.lossPercentage);
    const fuel = window.ReportUtils.number(rr?.fuel?.consumedDaily);

    if (prod && filled > prod) critical++;
    if (prod && reject > prod) warn++;
    if (loss >= 50) warn++;
    if (!fuel) warn++;
    if (Array.isArray(rr?.warnings)) warn += rr.warnings.length;
    return { critical, warn };
  }

  async function refresh() {
    try {
      if (!window.firebase?.firestore) return;
      const snap = await firebase.firestore().collection('reports').get();
      let critical = 0, warn = 0, total = 0;
      snap.docs.forEach(d => {
        total++;
        const c = classify(d.data() || {});
        critical += c.critical;
        warn += c.warn;
      });
      let panel = document.getElementById('dataQualityPanel');
      if (!panel) {
        const stats = document.querySelector('.stats.dashboard-totals');
        if (!stats) return;
        panel = document.createElement('section');
        panel.id = 'dataQualityPanel';
        panel.className = 'data-quality-panel pro-quality';
        stats.insertAdjacentElement('afterend', panel);
      }
      panel.classList.add('pro-quality');
      panel.innerHTML = `<h3>فحص سريع لجودة البيانات <span class="stabilized-badge">من قاعدة البيانات</span></h3>
        <div class="data-quality-grid">
          <article class="data-quality-item critical ${critical ? 'has-critical' : ''}"><strong>${critical}</strong><span>أخطاء حرجة محسوبة</span></article>
          <article class="data-quality-item warning ${warn ? 'has-warnings' : ''}"><strong>${warn}</strong><span>تحذيرات تحتاج مراجعة</span></article>
          <article class="data-quality-item info"><strong>${total}</strong><span>تقرير في قاعدة البيانات</span></article>
        </div>`;
    } catch (e) {
      console.warn('data quality check skipped', e);
    }
  }

  return { refresh, classify };
})();
