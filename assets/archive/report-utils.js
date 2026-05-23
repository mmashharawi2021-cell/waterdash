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
    return `*${r.title}*\n\n📅 التاريخ: ${displayDate(r.reportDate)}\n📍 المحطة: ${r.stationName || '-'}\n\n⏱️ تشغيل المولد:\n▪️ البداية: ${r.generator.periods?.[0]?.startTime || '-'}\n▪️ الإيقاف: ${r.generator.periods?.[0]?.stopTime || '-'}\n▪️ ساعات التشغيل: ${r.generator.totalRunHours || '-'}\n▪️ الحالة: ${r.generator.status || '-'}\n\n⛽ الوقود:\n▪️ المضاف يومياً: ${r.fuel.addedDaily || '_'} لتر\n▪️ المستهلك يومياً: ${r.fuel.consumedDaily || '_'} لتر\n▪️ المورد من البلدية: ${r.fuel.municipalSupplied || '_'} لتر\n▪️ الرصيد السابق: ${r.fuel.previousBalance || '_'} لتر\n▪️ الرصيد الحالي: ${r.fuel.currentBalance || '_'} لتر\n▪️ الفرق/الفاقد: ${r.fuel.loss || '_'} لتر\n\n💧 كميات المياه:\n▪️ إنتاج الغاطس: ${r.water.submersibleRate || '_'} كوب/ساعة\n▪️ بعد الفلترة: ${r.water.filteredRate || '_'} كوب/ساعة\n▪️ الإنتاج اليومي: ${r.water.dailyProduction || '_'} كوب\n▪️ العادم: ${r.water.rejectWater || '_'} كوب\n▪️ إجمالي المياه الداخلة: ${r.water.totalInputWater || '_'} كوب\n▪️ نسبة الاسترداد: ${r.water.recoveryRate || '_'}%\n▪️ نسبة العادم: ${r.water.rejectRatePercentage || '_'}%\n▪️ نسبة الفاقد: ${r.water.lossPercentage || '_'}%\n▪️ المعبأ للجهات: ${r.water.filledWater || 0} كوب\n▪️ عدد السيارات: ${r.water.carsCount || 0}\n▪️ متوسط السيارة: ${r.water.averagePerCar || '_'} كوب\n\n🧪 فحوصات المياه:\n▪️ PH بعد التحلية: ${r.tests.phAfterDesalination || '_'}\n▪️ PH مياه الغاطس: ${r.tests.phWellWater || '_'}\n▪️ TDS مياه محلاة: ${r.tests.tdsDesalinated || '_'}\n▪️ TDS بئر: ${r.tests.tdsWell || '_'}\n▪️ TDS عادم: ${r.tests.tdsReject || '_'}\n▪️ الكلور الحر: ${r.tests.freeChlorine || '_'}\n\n🚚 الجهات المستفيدة:\n${beneficiaries || 'لا توجد جهات مدخلة'}\n\n📝 ملاحظات:\n${r.notes || r.generalNotes || '_'}`;
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
