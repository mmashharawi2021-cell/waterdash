/* --- Auto-Generated Module: reports-system.js --- */

/* ==========================================
   FILE: report-utils.js
   ========================================== */
window.ReportUtils = (() => {
  function emptyReport() {
    const today = new Date().toISOString().slice(0, 10);
    return {
      title: `تقرير تشغيل وضخ المياه ${displayDate(today)}`,
      reportDate: today,
      stationName: window.WATER_APP_SETTINGS.defaultStationName,
      wellName: window.WATER_APP_SETTINGS.defaultWellName,
      operatorName: '',
      generalNotes: '',
      generator: { periods: [{ startTime: '', stopTime: '', runHours: '' }], totalRunHours: '', status: 'يعمل', operatorName: '', notes: '', extraFields: [] },
      fuel: { addedDaily: '', consumedDaily: '', municipalSupplied: '', previousBalance: '', currentBalance: '', loss: '', notes: '', extraFields: [] },
      water: { dailyProduction: '', rejectWater: '', lossPercentage: '', recoveryRate: '', rejectRatePercentage: '', totalInputWater: '', totalInputRate: '', filledWater: '', carsCount: '', averagePerCar: '', notes: '', filteredRate: '', submersibleRate: '' },
      tests: { phAfterDesalination: '', phWellWater: '', tdsDesalinated: '', tdsWell: '', tdsReject: '', freeChlorine: '', extraFields: [] },
      beneficiaries: [],
      notes: '',
      sourceText: '',
      warnings: []
    };
  }

  function displayDate(date) {
    const parts = String(date || '').split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;
  }

  function timeToMinutes(time) {
    if (!time) return 0;
    const [h, m] = String(time).split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
  }

  function minutesToHours(minutes) {
    if (!minutes) return '';
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
  }

  function calcRunHours(start, stop) {
    if (!start || !stop) return '';
    let s = timeToMinutes(start);
    let e = timeToMinutes(stop);
    if (e < s) e += 1440;
    return minutesToHours(e - s);
  }

  function hoursToDecimal(hours) {
    if (!hours) return 0;
    const [h, m = 0] = String(hours).split(':').map(Number);
    return (Number(h) || 0) + ((Number(m) || 0) / 60);
  }

  function number(value) {
    const n = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  function round(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    const r = +n.toFixed(2);
    return Number.isInteger(r) ? r : r;
  }

  function recalc(report) {
    const r = structuredClone(report || emptyReport());
    r.water = { ...emptyReport().water, ...(r.water || {}) };
    r.beneficiaries = Array.isArray(r.beneficiaries) ? r.beneficiaries : [];
    const periods = Array.isArray(r.generator?.periods) ? r.generator.periods : [];
    let totalMinutes = 0;
    periods.forEach(period => {
      if (!period.runHours) period.runHours = calcRunHours(period.startTime, period.stopTime);
      const [h, m = 0] = String(period.runHours || '').split(':').map(Number);
      totalMinutes += (Number(h) || 0) * 60 + (Number(m) || 0);
    });
    r.generator.totalRunHours = r.generator.totalRunHours || minutesToHours(totalMinutes);
    r.water.filledWater = r.beneficiaries.reduce((sum, item) => sum + number(item.quantity), 0);
    r.water.carsCount = r.beneficiaries.reduce((sum, item) => sum + number(item.cars), 0);
    r.water.averagePerCar = number(r.water.carsCount) ? round(number(r.water.filledWater) / number(r.water.carsCount)) : '';

    const runHoursDecimal = hoursToDecimal(r.generator.totalRunHours);
    if (!number(r.water.dailyProduction) && number(r.water.filteredRate) && runHoursDecimal) {
      r.water.dailyProduction = round(number(r.water.filteredRate) * runHoursDecimal);
    }
    if (!number(r.water.rejectWater) && number(r.water.submersibleRate) && number(r.water.filteredRate) && runHoursDecimal) {
      r.water.rejectWater = round((number(r.water.submersibleRate) - number(r.water.filteredRate)) * runHoursDecimal);
    }

    const dailyProduction = number(r.water.dailyProduction);
    const rejectWater = number(r.water.rejectWater);
    const totalInput = dailyProduction + rejectWater;
    if (totalInput) {
      r.water.totalInputWater = round(totalInput);
      r.water.recoveryRate = round((dailyProduction / totalInput) * 100);
      r.water.rejectRatePercentage = round((rejectWater / totalInput) * 100);
    } else {
      const filteredRate = number(r.water.filteredRate);
      const submersibleRate = number(r.water.submersibleRate);
      const rejectRateHourly = Math.max(submersibleRate - filteredRate, 0);
      const totalRate = submersibleRate || (filteredRate + rejectRateHourly);
      if (totalRate) {
        r.water.recoveryRate = round((filteredRate / totalRate) * 100);
        r.water.rejectRatePercentage = round((rejectRateHourly / totalRate) * 100);
      }
    }
    r.water.totalInputRate = number(r.water.submersibleRate) ? round(number(r.water.submersibleRate)) : '';

    if (dailyProduction && rejectWater) {
      r.water.lossPercentage = round((rejectWater / dailyProduction) * 100);
    }
    const warnings = Array.isArray(r.warnings) ? [...r.warnings] : [];
    if (dailyProduction && number(r.water.filledWater) > dailyProduction) {
      warnings.push('كمية المياه المعبأة أكبر من الإنتاج اليومي المحسوب.');
    }
    r.warnings = [...new Set(warnings)];
    return r;
  }

  function fromParsed(parsed) {
    const base = emptyReport();
    const firstPeriod = { startTime: parsed.generatorStart || '', stopTime: parsed.generatorEnd || '', runHours: parsed.runHours || '' };
    const report = {
      ...base,
      title: parsed.title || base.title,
      reportDate: parsed.date || base.reportDate,
      operatorName: parsed.operatorName || '',
      generalNotes: parsed.generalNotes || '',
      generator: { ...base.generator, periods: [firstPeriod], totalRunHours: parsed.runHours || '', status: parsed.generatorStatus || 'يعمل', operatorName: parsed.operatorName || '', notes: parsed.generatorNotes || '' },
      fuel: { ...base.fuel, addedDaily: parsed.fuelAdded || '', consumedDaily: parsed.fuelConsumed || '', municipalSupplied: parsed.fuelMunicipal || '', previousBalance: parsed.previousFuelBalance || '', currentBalance: parsed.fuelBalance || '', loss: parsed.fuelLoss || '', notes: parsed.fuelNotes || '' },
      water: { ...base.water, dailyProduction: parsed.dailyProduction || '', rejectWater: parsed.rejectWater || '', filledWater: parsed.totalQuantity || '', carsCount: parsed.totalCars || '', averagePerCar: '', notes: parsed.waterNotes || '', filteredRate: parsed.filteredRate || '', submersibleRate: parsed.submersibleRate || '' },
      tests: { ...base.tests, phAfterDesalination: parsed.phFiltered || '', phWellWater: parsed.phWell || '', tdsDesalinated: parsed.tdsFiltered || '', tdsWell: parsed.tdsWell || '', tdsReject: parsed.tdsWaste || '', freeChlorine: parsed.chlorine || '' },
      beneficiaries: (parsed.beneficiaries || []).map((item, index) => ({ id: item.id || `b-${Date.now()}-${index}`, name: item.name, quantity: item.quantity, cars: item.cars, notes: item.notes || '' })),
      sourceText: parsed.sourceText || '',
      warnings: parsed.warnings || []
    };
    return recalc(report);
  }

  function whatsappText(report) {
    const r = recalc(report);
    const beneficiaries = (r.beneficiaries || []).map(item => `▪️ ${item.name}\nالكمية/ ${item.quantity || 0} كوب ، عدد السيارات/ ${item.cars || 0}`).join('\n\n');
    return `*${r.title}*\n\n📅 التاريخ: ${displayDate(r.reportDate)}\n📍 المحطة: ${r.stationName || '-'}\n\n⏱️ تشغيل المولد:\n▪️ البداية: ${r.generator.periods?.[0]?.startTime || '-'}\n▪️ الإيقاف: ${r.generator.periods?.[0]?.stopTime || '-'}\n▪️ ساعات التشغيل: ${r.generator.totalRunHours || '-'}\n▪️ الحالة: ${r.generator.status || '-'}\n\n⛽ الوقود:\n▪️ المضاف يومياً: ${r.fuel.addedDaily || '_'} لتر\n▪️ المستهلك يومياً: ${r.fuel.consumedDaily || '_'} لتر\n▪️ المورد من البلدية: ${r.fuel.municipalSupplied || '_'} لتر\n▪️ الرصيد السابق: ${r.fuel.previousBalance || '_'} لتر\n▪️ الرصيد الحالي: ${r.fuel.currentBalance || '_'} لتر\n▪️ الفرق/الفاقد: ${r.fuel.loss || '_'} لتر\n\n💧 كميات المياه:\n▪️ إنتاج الغاطس: ${r.water.submersibleRate || '_'} كوب/ساعة\n▪️ بعد الفلترة: ${r.water.filteredRate || '_'} كوب/ساعة\n▪️ الإنتاج اليومي: ${r.water.dailyProduction || '_'} كوب\n▪️ العادم: ${r.water.rejectWater || '_'} كوب\n▪️ إجمالي المياه الداخلة: ${r.water.totalInputWater || '_'} كوب\n▪️ نسبة الاسترداد: ${r.water.recoveryRate || '_'}%\n▪️ نسبة العادم: ${r.water.rejectRatePercentage || '_'}%\n▪️ نسبة الفاقد: ${r.water.lossPercentage || '_'}%\n▪️ المعبأ للجهات: ${r.water.filledWater || 0} كوب\n▪️ عدد السيارات: ${r.water.carsCount || 0}\n\n🧪 فحوصات المياه:\n▪️ PH بعد التحلية: ${r.tests.phAfterDesalination || '_'}\n▪️ PH مياه الغاطس: ${r.tests.phWellWater || '_'}\n▪️ TDS مياه محلاة: ${r.tests.tdsDesalinated || '_'}\n▪️ TDS بئر: ${r.tests.tdsWell || '_'}\n▪️ TDS عادم: ${r.tests.tdsReject || '_'}\n▪️ الكلور الحر: ${r.tests.freeChlorine || '_'}\n\n🚚 الجهات المستفيدة:\n${beneficiaries || 'لا توجد جهات مدخلة'}\n\n📝 ملاحظات:\n${r.notes || r.generalNotes || '_'}`;
  }

  function summary(reports) {
    const list = reports || [];
    const totals = list.reduce((acc, item) => {
      const r = recalc(item);
      acc.runHours += hoursToDecimal(r.generator.totalRunHours);
      acc.fuelConsumed += number(r.fuel.consumedDaily);
      acc.fuelSupplied += number(r.fuel.municipalSupplied);
      acc.waterProduction += number(r.water.dailyProduction);
      acc.rejectWater += number(r.water.rejectWater);
      acc.filledWater += number(r.water.filledWater);
      acc.cars += number(r.water.carsCount);
      return acc;
    }, { runHours: 0, fuelConsumed: 0, fuelSupplied: 0, waterProduction: 0, rejectWater: 0, filledWater: 0, cars: 0 });
    totals.averageDailyProduction = list.length ? round(totals.waterProduction / list.length) : 0;
    totals.averageFuelConsumption = list.length ? round(totals.fuelConsumed / list.length) : 0;
    totals.lossPercentage = totals.waterProduction ? round((totals.rejectWater / totals.waterProduction) * 100) : 0;
    totals.totalInputWater = round(totals.waterProduction + totals.rejectWater) || 0;
    totals.recoveryRate = totals.totalInputWater ? round((totals.waterProduction / totals.totalInputWater) * 100) : 0;
    totals.rejectRatePercentage = totals.totalInputWater ? round((totals.rejectWater / totals.totalInputWater) * 100) : 0;
    return totals;
  }

  return { emptyReport, displayDate, calcRunHours, recalc, fromParsed, whatsappText, summary, number };
})();


/* ==========================================
   FILE: report-utils-time-patch.js
   ========================================== */
(() => {
  if (!window.ReportUtils) return;

  const original = window.ReportUtils;

  function normalizeArabicDigits(value) {
    return String(value ?? '')
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  }

  function normalizeDateInput(value) {
    const raw = normalizeArabicDigits(value).trim();
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
    let raw = normalizeArabicDigits(value).trim().toLowerCase();
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
    if (!minutes) return '';
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

  function number(value) {
    return original.number(value);
  }

  function recalc(report) {
    const r = structuredClone(report || original.emptyReport());
    r.reportDate = normalizeDateInput(r.reportDate || '');
    r.generator = r.generator || { periods: [] };
    r.fuel = r.fuel || {};
    r.water = r.water || {};
    r.tests = r.tests || {};
    r.beneficiaries = Array.isArray(r.beneficiaries) ? r.beneficiaries : [];

    const periods = Array.isArray(r.generator.periods) ? r.generator.periods : [];
    let totalMinutes = 0;
    periods.forEach(period => {
      period.startTime = normalizeTimeInput(period.startTime || '');
      period.stopTime = normalizeTimeInput(period.stopTime || '');
      period.runHours = period.runHours || calcRunHours(period.startTime, period.stopTime);
      const [h, m = 0] = String(period.runHours || '').split(':').map(Number);
      totalMinutes += (Number(h) || 0) * 60 + (Number(m) || 0);
    });

    r.generator.periods = periods;
    r.generator.totalRunHours = r.generator.totalRunHours || minutesToHours(totalMinutes);

    const beneficiariesFilled = r.beneficiaries.reduce((sum, item) => sum + number(item.quantity), 0);
    const beneficiariesCars = r.beneficiaries.reduce((sum, item) => sum + number(item.cars), 0);
    const manualFilled = number(r.water.manualFilledWater);

    r.water.filledWater = manualFilled || beneficiariesFilled;
    r.water.carsCount = beneficiariesCars;
    r.water.averagePerCar = number(r.water.carsCount) ? +(number(r.water.filledWater) / number(r.water.carsCount)).toFixed(2) : '';

    const runHoursDecimal = hoursToDecimal(r.generator.totalRunHours);
    if (!number(r.water.dailyProduction) && number(r.water.filteredRate) && runHoursDecimal) {
      r.water.dailyProduction = +(number(r.water.filteredRate) * runHoursDecimal).toFixed(2);
    }
    if (!number(r.water.rejectWater) && number(r.water.submersibleRate) && number(r.water.filteredRate) && runHoursDecimal) {
      r.water.rejectWater = +((number(r.water.submersibleRate) - number(r.water.filteredRate)) * runHoursDecimal).toFixed(2);
    }
    if (number(r.water.dailyProduction) && number(r.water.rejectWater)) {
      r.water.lossPercentage = +((number(r.water.rejectWater) / number(r.water.dailyProduction)) * 100).toFixed(2);
    }

    const warnings = [];
    if (number(r.water.dailyProduction) && number(r.water.filledWater) > number(r.water.dailyProduction)) {
      warnings.push('كمية المياه المعبأة أكبر من الإنتاج اليومي المحسوب.');
    }
    if (manualFilled && beneficiariesFilled && Math.abs(manualFilled - beneficiariesFilled) > 0.5) {
      warnings.push('إجمالي المياه المعبأة معدّل يدويًا ولا يطابق مجموع الجهات.');
    }
    if (r.beneficiaries.some(item => String(item.name || '').trim() && (!number(item.quantity) || !number(item.cars)))) {
      warnings.push('بعض الجهات لديها اسم بدون كمية أو عدد سيارات.');
    }

    r.warnings = [...new Set(warnings)];
    return r;
  }

  function whatsappText(report) {
    const r = recalc(report);
    const beneficiaries = (r.beneficiaries || []).map(item => `▪️ ${item.name}\nالكمية/ ${item.quantity || 0} كوب ، عدد السيارات/ ${item.cars || 0}`).join('\n\n');
    return `*${r.title}*\n\n📅 التاريخ: ${displayDate(r.reportDate)}\n📍 المحطة: ${r.stationName || '-'}\n\n⏱️ تشغيل المولد:\n▪️ البداية: ${displayTimeArabic(r.generator.periods?.[0]?.startTime) || '-'}\n▪️ الإيقاف: ${displayTimeArabic(r.generator.periods?.[0]?.stopTime) || '-'}\n▪️ ساعات التشغيل: ${r.generator.totalRunHours || '-'}\n▪️ الحالة: ${r.generator.status || '-'}\n\n⛽ الوقود:\n▪️ المضاف يومياً: ${r.fuel.addedDaily || '_'} لتر\n▪️ المستهلك يومياً: ${r.fuel.consumedDaily || '_'} لتر\n▪️ المورد من البلدية: ${r.fuel.municipalSupplied || '_'} لتر\n▪️ الرصيد السابق: ${r.fuel.previousBalance || '_'} لتر\n▪️ الرصيد الحالي: ${r.fuel.currentBalance || '_'} لتر\n▪️ الفرق/الفاقد: ${r.fuel.loss || '_'} لتر\n\n💧 كميات المياه:\n▪️ إنتاج الغاطس: ${r.water.submersibleRate || '_'} كوب/ساعة\n▪️ بعد الفلترة: ${r.water.filteredRate || '_'} كوب/ساعة\n▪️ الإنتاج اليومي: ${r.water.dailyProduction || '_'} كوب\n▪️ العادم: ${r.water.rejectWater || '_'} كوب\n▪️ نسبة الفاقد: ${r.water.lossPercentage || '_'}%\n▪️ المعبأ للجهات: ${r.water.filledWater || 0} كوب\n▪️ عدد السيارات: ${r.water.carsCount || 0}\n\n🧪 فحوصات المياه:\n▪️ PH بعد التحلية: ${r.tests.phAfterDesalination || '_'}\n▪️ PH مياه الغاطس: ${r.tests.phWellWater || '_'}\n▪️ TDS مياه محلاة: ${r.tests.tdsDesalinated || '_'}\n▪️ TDS بئر: ${r.tests.tdsWell || '_'}\n▪️ TDS عادم: ${r.tests.tdsReject || '_'}\n▪️ الكلور الحر: ${r.tests.freeChlorine || '_'}\n\n🚚 الجهات المستفيدة:\n${beneficiaries || 'لا توجد جهات مدخلة'}\n\n📝 ملاحظات:\n${r.notes || r.generalNotes || '_'}`;
  }

  function summary(reports) {
    const list = reports || [];
    const totals = list.reduce((acc, item) => {
      const r = recalc(item);
      acc.runHours += hoursToDecimal(r.generator.totalRunHours);
      acc.fuelConsumed += number(r.fuel.consumedDaily);
      acc.fuelSupplied += number(r.fuel.municipalSupplied);
      acc.waterProduction += number(r.water.dailyProduction);
      acc.rejectWater += number(r.water.rejectWater);
      acc.filledWater += number(r.water.filledWater);
      acc.cars += number(r.water.carsCount);
      return acc;
    }, { runHours: 0, fuelConsumed: 0, fuelSupplied: 0, waterProduction: 0, rejectWater: 0, filledWater: 0, cars: 0 });
    totals.averageDailyProduction = list.length ? +(totals.waterProduction / list.length).toFixed(2) : 0;
    totals.averageFuelConsumption = list.length ? +(totals.fuelConsumed / list.length).toFixed(2) : 0;
    totals.lossPercentage = totals.waterProduction ? +((totals.rejectWater / totals.waterProduction) * 100).toFixed(2) : 0;
    return totals;
  }

  window.ReportUtils = {
    ...original,
    displayDate,
    calcRunHours,
    recalc,
    whatsappText,
    summary,
    normalizeTimeInput,
    displayTimeArabic,
    normalizeDateInput
  };
})();


/* ==========================================
   FILE: live-calculations.js
   ========================================== */
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

    if (runHours && shouldAutoFill(rejectWaterInput, waterSourceChanged)) {
      const fixedLoss = Number(window.WATER_APP_SETTINGS?.lossPercentage);
      if (!isNaN(fixedLoss) && fixedLoss > 0 && fixedLoss < 100) {
        // حساب العادم بناءً على الفاقد الثابت
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
      const fixedLoss = Number(window.WATER_APP_SETTINGS?.lossPercentage);
      if (!isNaN(fixedLoss) && fixedLoss > 0 && fixedLoss < 100 && Math.abs((rejectWater/dailyProduction)*100 - fixedLoss) < 1) {
        set(form, 'lossPercentage', fixedLoss);
      } else {
        set(form, 'lossPercentage', cleanNumber((rejectWater / dailyProduction) * 100));
      }
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
    } else {
      if (shouldAutoFill(totalInputWaterInput, waterSourceChanged)) set(form, 'totalInputWater', '');
      if (shouldAutoFill(recoveryRateInput, waterSourceChanged)) set(form, 'recoveryRate', '');
      if (shouldAutoFill(rejectRatePercentageInput, waterSourceChanged)) set(form, 'rejectRatePercentage', '');
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

  function observeForms() {
    bindLiveCalculations();
    const observer = new MutationObserver(() => bindLiveCalculations());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.LiveCalculations = { bind: bindLiveCalculations, runAll, fuelRate: FUEL_CONSUMPTION_PER_HOUR };
  window.addEventListener('DOMContentLoaded', observeForms);
})();


/* ==========================================
   FILE: fuel-dashboard-patch.js
   ========================================== */
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


/* ==========================================
   FILE: external-water-and-save-patch.js
   ========================================== */
(() => {
  function isExternalWaterName(value) {
    const text = String(value || '').trim();
    return text.includes('مياه خارجية') || text.includes('صنابير للمواطنين') || text.includes('خارج المحطة');
  }

  function patchExternalWaterRows() {
    document.querySelectorAll('#beneficiariesRows tr').forEach(row => {
      const nameInput = row.querySelector('[data-b="name"]');
      const carsInput = row.querySelector('[data-b="cars"]');
      if (!nameInput || !carsInput) return;

      const carsCell = carsInput.closest('td');
      if (isExternalWaterName(nameInput.value)) {
        carsInput.value = '';
        carsInput.readOnly = true;
        carsInput.dataset.externalWater = 'true';
        carsInput.classList.add('external-water-cars-input');
        row.classList.add('external-water-row');
        if (carsCell && !carsCell.querySelector('.external-water-note')) {
          carsCell.insertAdjacentHTML('beforeend', '<span class="external-water-note">لا يوجد سيارات</span>');
        }
      } else {
        carsInput.readOnly = false;
        delete carsInput.dataset.externalWater;
        carsInput.classList.remove('external-water-cars-input');
        row.classList.remove('external-water-row');
        carsCell?.querySelector('.external-water-note')?.remove();
      }
    });
  }

  function observeBeneficiaryRows() {
    patchExternalWaterRows();
    document.body.addEventListener('input', event => {
      if (event.target?.matches?.('[data-b="name"]')) patchExternalWaterRows();
    });
    document.body.addEventListener('change', event => {
      if (event.target?.matches?.('[data-b="name"]')) patchExternalWaterRows();
    });

    const observer = new MutationObserver(() => patchExternalWaterRows());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.ExternalWaterPatch = { patch: patchExternalWaterRows };
  window.addEventListener('DOMContentLoaded', observeBeneficiaryRows);
})();


/* ==========================================
   FILE: fuel-previous-and-time-fix.js
   ========================================== */
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


/* ==========================================
   FILE: fuel-kpi-override.js
   ========================================== */
(() => {
  const VERSION = '20260513-fuel-kpi-override-2';

  function num(value) {
    if (window.ReportUtils?.number) return window.ReportUtils.number(value);
    const n = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function fmt(value) {
    const n = num(value);
    const r = +n.toFixed(2);
    return Number.isInteger(r) ? String(r) : String(r);
  }

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function displayDate(date) {
    return window.ReportUtils?.displayDate ? window.ReportUtils.displayDate(date) : String(date || '');
  }

  function fuelEntryKey(entry) {
    return [
      clean(entry.date),
      clean(entry.time),
      clean(entry.supplier || entry.donor),
      fmt(entry.quantityLiters ?? entry.quantity),
      clean(entry.fillingMethod),
      clean(entry.deliveredBy)
    ].join('|');
  }

  function uniqueFuelEntries(entries) {
    const seen = new Set();
    const unique = [];
    entries.forEach(entry => {
      const key = fuelEntryKey(entry);
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(entry);
    });
    return unique;
  }

  function normalizeFuelDoc(doc) {
    const data = doc.data ? doc.data() : doc;
    return {
      date: data.date || '',
      time: data.time || '',
      supplier: data.supplier || data.donor || '',
      quantityLiters: data.quantityLiters ?? data.quantity ?? '',
      fillingMethod: data.fillingMethod || '',
      deliveredBy: data.deliveredBy || ''
    };
  }

  function findCard(patterns) {
    const cards = [...document.querySelectorAll('.kpi-card, .kpi-wide')];
    return cards.find(card => patterns.some(pattern => pattern.test(card.textContent || ''))) || null;
  }

  function setCard(card, label, value, hint, className) {
    if (!card) return;
    card.classList.add(className);
    const span = card.querySelector('span');
    const strong = card.querySelector('strong');
    const small = card.querySelector('small');
    if (span) span.textContent = label;
    if (strong) strong.textContent = fmt(value);
    if (small) small.textContent = hint;
  }

  function renderValues({ incoming, used, remaining, startDate }) {
    document.documentElement.dataset.fuelKpiOverride = VERSION;

    const remainingCard = findCard([/السولار في المخزون/, /آخر رصيد/, /وقود متبقي/]);
    const usedCard = findCard([/وقود مستهلك/, /إجمالي السولار المستهلك/, /وقود مستخدم/]);
    const incomingCard = findCard([/إجمالي السولار المستلم/, /سولار مستلم/, /وقود وارد/]);
    const dateHint = startDate ? `من ${displayDate(startDate)} حتى اليوم` : 'لا يوجد وقود وارد بعد';

    setCard(incomingCard, 'وقود وارد', incoming, 'من زر إضافة وقود وارد', 'fuel-incoming-kpi');
    setCard(usedCard, 'وقود مستخدم', used, dateHint, 'fuel-used-kpi');
    setCard(remainingCard, 'وقود متبقي', remaining, 'الوارد - المستخدم لنفس الفترة', 'fuel-remaining-kpi');
  }

  async function fetchSummary() {
    if (!window.firebase?.firestore) return null;
    const db = firebase.firestore();
    const [fuelSnap, reportsSnap] = await Promise.all([
      db.collection('fuelEntries').get(),
      db.collection('reports').get()
    ]);

    const incomingEntries = uniqueFuelEntries(fuelSnap.docs.map(normalizeFuelDoc));
    const incoming = incomingEntries.reduce((sum, entry) => sum + num(entry.quantityLiters), 0);
    const dates = incomingEntries.map(entry => entry.date).filter(Boolean).sort();
    const startDate = dates[0] || '';

    const used = startDate
      ? reportsSnap.docs.reduce((sum, doc) => {
          const data = doc.data() || {};
          if (!data.reportDate || data.reportDate < startDate) return sum;
          return sum + num(data?.fuel?.consumedDaily);
        }, 0)
      : 0;

    return { incoming, used, remaining: incoming - used, startDate };
  }

  async function update() {
    try {
      const summary = await fetchSummary();
      if (summary) renderValues(summary);
    } catch (error) {
      console.warn('fuel kpi override skipped', error);
    }
  }

  function start() {
    setTimeout(update, 700);
    setTimeout(update, 2200);
    setTimeout(update, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  if (window.firebase?.auth) {
    try {
      firebase.auth().onAuthStateChanged(() => setTimeout(update, 700));
    } catch {}
  }
})();


/* ==========================================
   FILE: data-quality-pro.js
   ========================================== */
(()=>{
  function n(v){if(window.ReportUtils?.number)return window.ReportUtils.number(v);const x=Number(String(v??'').replace(',','.').replace(/[^0-9.\-]/g,''));return Number.isFinite(x)?x:0}
  function classify(r){const rr=window.ReportUtils?.recalc?window.ReportUtils.recalc(r):r;let critical=0,warn=0;const prod=n(rr?.water?.dailyProduction),filled=n(rr?.water?.filledWater),reject=n(rr?.water?.rejectWater),loss=n(rr?.water?.lossPercentage),fuel=n(rr?.fuel?.consumedDaily);if(prod&&filled>prod)critical++;if(prod&&reject>prod)warn++;if(loss>=50)warn++;if(!fuel)warn++;if(Array.isArray(rr?.warnings))warn+=rr.warnings.length;return{critical,warn}}
  async function refresh(){try{if(!window.firebase?.firestore)return;const snap=await firebase.firestore().collection('reports').get();let critical=0,warn=0,total=0;snap.docs.forEach(d=>{total++;const c=classify(d.data()||{});critical+=c.critical;warn+=c.warn});let panel=document.getElementById('dataQualityPanel');if(!panel){const stats=document.querySelector('.stats.dashboard-totals');if(!stats)return;panel=document.createElement('section');panel.id='dataQualityPanel';panel.className='data-quality-panel pro-quality';stats.insertAdjacentElement('afterend',panel)}panel.classList.add('pro-quality');panel.innerHTML='<h3>فحص سريع لجودة البيانات <span class="stabilized-badge">من قاعدة البيانات</span></h3><div class="data-quality-grid"><article class="data-quality-item critical '+(critical?'has-critical':'')+'"><strong>'+critical+'</strong><span>أخطاء حرجة محسوبة</span></article><article class="data-quality-item warning '+(warn?'has-warnings':'')+'"><strong>'+warn+'</strong><span>تحذيرات تحتاج مراجعة</span></article><article class="data-quality-item info"><strong>'+total+'</strong><span>تقرير في قاعدة البيانات</span></article></div>'}catch(e){console.warn('data quality failed',e)}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,1200));else setTimeout(refresh,1200);setTimeout(refresh,3200);window.WaterDataQualityPro={refresh};
})();

