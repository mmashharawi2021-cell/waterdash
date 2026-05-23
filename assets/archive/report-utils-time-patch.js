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
    const m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
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
    return `*${r.title}*\n\n📅 التاريخ: ${displayDate(r.reportDate)}\n📍 المحطة: ${r.stationName || '-'}\n\n⏱️ تشغيل المولد:\n▪️ البداية: ${displayTimeArabic(r.generator.periods?.[0]?.startTime) || '-'}\n▪️ الإيقاف: ${displayTimeArabic(r.generator.periods?.[0]?.stopTime) || '-'}\n▪️ ساعات التشغيل: ${r.generator.totalRunHours || '-'}\n▪️ الحالة: ${r.generator.status || '-'}\n\n⛽ الوقود:\n▪️ المضاف يومياً: ${r.fuel.addedDaily || '_'} لتر\n▪️ المستهلك يومياً: ${r.fuel.consumedDaily || '_'} لتر\n▪️ المورد من البلدية: ${r.fuel.municipalSupplied || '_'} لتر\n▪️ الرصيد السابق: ${r.fuel.previousBalance || '_'} لتر\n▪️ الرصيد الحالي: ${r.fuel.currentBalance || '_'} لتر\n▪️ الفرق/الفاقد: ${r.fuel.loss || '_'} لتر\n\n💧 كميات المياه:\n▪️ إنتاج الغاطس: ${r.water.submersibleRate || '_'} كوب/ساعة\n▪️ بعد الفلترة: ${r.water.filteredRate || '_'} كوب/ساعة\n▪️ الإنتاج اليومي: ${r.water.dailyProduction || '_'} كوب\n▪️ العادم: ${r.water.rejectWater || '_'} كوب\n▪️ نسبة الفاقد: ${r.water.lossPercentage || '_'}%\n▪️ المعبأ للجهات: ${r.water.filledWater || 0} كوب\n▪️ عدد السيارات: ${r.water.carsCount || 0}\n▪️ متوسط السيارة: ${r.water.averagePerCar || '_'} كوب\n\n🧪 فحوصات المياه:\n▪️ PH بعد التحلية: ${r.tests.phAfterDesalination || '_'}\n▪️ PH مياه الغاطس: ${r.tests.phWellWater || '_'}\n▪️ TDS مياه محلاة: ${r.tests.tdsDesalinated || '_'}\n▪️ TDS بئر: ${r.tests.tdsWell || '_'}\n▪️ TDS عادم: ${r.tests.tdsReject || '_'}\n▪️ الكلور الحر: ${r.tests.freeChlorine || '_'}\n\n🚚 الجهات المستفيدة:\n${beneficiaries || 'لا توجد جهات مدخلة'}\n\n📝 ملاحظات:\n${r.notes || r.generalNotes || '_'}`;
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
