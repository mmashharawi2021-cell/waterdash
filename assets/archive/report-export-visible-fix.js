(() => {
  const REPORT_TYPES = new Set(['allReports', 'dailyFull', 'monthlyFull', 'monthlyShort', 'customReport']);

  const LABELS = {
    allReports: 'تصدير التقارير بالكامل',
    dailyFull: 'تقرير يومي شامل',
    monthlyFull: 'تقرير شهري شامل',
    monthlyShort: 'تقرير شهري مختصر',
    customReport: 'تقرير مخصص',
    fuelSummary: 'تصدير الوقود',
    incomingFuel: 'تصدير الوقود الوارد',
    consumedFuel: 'تصدير الوقود المستهلك',
    producedWater: 'تصدير المياه المنتجة',
    deliveredWater: 'تصدير المياه المعبأة للجهات',
    beneficiaries: 'تصدير الجهات المستفيدة',
    beneficiaryOne: 'تصدير جهة مستفيدة محددة'
  };

  function cleanName(value) {
    return String(value || 'تصدير التقارير').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);
  }

  function n(value) {
    if (window.ReportUtils?.number) return window.ReportUtils.number(value);
    const parsed = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function prettyNumber(value, digits = 2) {
    const parsed = n(value);
    const rounded = +parsed.toFixed(digits);
    return Number.isInteger(rounded) ? rounded : rounded;
  }

  function clone(value) {
    try { return structuredClone(value); }
    catch { return JSON.parse(JSON.stringify(value || {})); }
  }

  function recalc(report) {
    try { return window.ReportUtils?.recalc ? window.ReportUtils.recalc(clone(report || {})) : clone(report || {}); }
    catch { return clone(report || {}); }
  }

  function dateText(value) {
    return window.ReportUtils?.displayDate ? window.ReportUtils.displayDate(value) : (value || '');
  }

  function timeText(value) {
    return window.ReportUtils?.displayTimeArabic?.(value) || value || '';
  }

  function firstPeriod(report) {
    return report?.generator?.periods?.[0] || {};
  }

  function reportRows(reports) {
    const list = (reports || []).map(recalc).filter(item => item.reportDate || item.title);
    const maxBeneficiaries = Math.max(1, ...list.map(report => (report.beneficiaries || []).length));

    return list.map((report, index) => {
      const period = firstPeriod(report);
      const row = {
        'م': index + 1,
        'التاريخ': dateText(report.reportDate),
        'عنوان التقرير': report.title || '',
        'المحطة': report.stationName || '',
        'البئر': report.wellName || '',
        'المشغل': report.operatorName || report.generator?.operatorName || '',
        'بداية التشغيل': timeText(period.startTime),
        'وقت الإيقاف': timeText(period.stopTime),
        'ساعات التشغيل': report.generator?.totalRunHours || '',
        'حالة المولد': report.generator?.status || '',
        'الوقود المضاف يوميًا / لتر': report.fuel?.addedDaily || '',
        'الوقود المستهلك يوميًا / لتر': report.fuel?.consumedDaily || '',
        'الوقود المورد من البلدية / لتر': report.fuel?.municipalSupplied || '',
        'الرصيد السابق / لتر': report.fuel?.previousBalance || '',
        'الرصيد الحالي / لتر': report.fuel?.currentBalance || '',
        'فرق/فاقد الوقود / لتر': report.fuel?.loss || '',
        'إنتاج الغاطس كوب/ساعة': report.water?.submersibleRate || '',
        'بعد الفلترة كوب/ساعة': report.water?.filteredRate || '',
        'الإنتاج اليومي / كوب': report.water?.dailyProduction || '',
        'العادم / كوب': report.water?.rejectWater || '',
        'نسبة الفاقد %': report.water?.lossPercentage || '',
        'إجمالي المياه المعبأة / كوب': report.water?.filledWater || '',
        'إجمالي عدد السيارات': report.water?.carsCount || '',
        'متوسط السيارة / كوب': report.water?.averagePerCar || '',
        'PH بعد التحلية': report.tests?.phAfterDesalination || '',
        'PH مياه الغاطس': report.tests?.phWellWater || '',
        'TDS مياه محلاة': report.tests?.tdsDesalinated || '',
        'TDS البئر': report.tests?.tdsWell || '',
        'TDS العادم': report.tests?.tdsReject || '',
        'الكلور الحر': report.tests?.freeChlorine || '',
        'عدد التنبيهات': (report.warnings || []).length,
        'التنبيهات': (report.warnings || []).join(' | '),
        'ملاحظات عامة': report.generalNotes || report.notes || ''
      };

      for (let i = 0; i < maxBeneficiaries; i += 1) {
        const beneficiary = report.beneficiaries?.[i] || {};
        const idx = i + 1;
        row[`الجهة ${idx}`] = beneficiary.name || '';
        row[`كمية الجهة ${idx} / كوب`] = beneficiary.quantity || '';
        row[`سيارات الجهة ${idx}`] = beneficiary.cars || '';
        row[`ملاحظات الجهة ${idx}`] = beneficiary.notes || '';
      }

      return row;
    });
  }

  function summaryOnlyRows(reports) {
    const list = (reports || []).map(recalc).filter(item => item.reportDate || item.title);
    let totals = {};
    try { totals = window.ReportUtils?.summary ? window.ReportUtils.summary(list) : {}; } catch {}
    return [{
      'عدد التقارير': list.length,
      'إجمالي ساعات التشغيل': prettyNumber(totals.runHours || 0),
      'إجمالي الوقود المستهلك / لتر': prettyNumber(totals.fuelConsumed || 0),
      'إجمالي الوقود المورد / لتر': prettyNumber(totals.fuelSupplied || 0),
      'إجمالي الإنتاج / كوب': prettyNumber(totals.waterProduction || 0),
      'إجمالي العادم / كوب': prettyNumber(totals.rejectWater || 0),
      'إجمالي المياه المعبأة / كوب': prettyNumber(totals.filledWater || 0),
      'إجمالي السيارات': prettyNumber(totals.cars || 0),
      'نسبة الفاقد %': prettyNumber(totals.lossPercentage || 0)
    }];
  }

  function beneficiaryRows(reports, specificName = '') {
    return (reports || []).flatMap(report => (report.beneficiaries || [])
      .filter(item => !specificName || String(item.name || '').includes(specificName))
      .map(item => ({
        'التاريخ': dateText(report.reportDate),
        'عنوان التقرير': report.title || '',
        'الجهة': item.name || '',
        'الكمية / كوب': item.quantity || '',
        'عدد السيارات': item.cars || '',
        'ملاحظات': item.notes || ''
      })));
  }

  function fuelIncomingRows(fuelEntries) {
    return (fuelEntries || []).map(item => ({
      'التاريخ': item.date || '',
      'اليوم': item.day || '',
      'الساعة': item.time || '',
      'المورد': item.supplier || item.donor || '',
      'الكمية / لتر': item.quantityLiters ?? item.quantity ?? '',
      'طريقة التعبئة': item.fillingMethod || '',
      'المسلّم': item.deliveredBy || '',
      'ملاحظات': item.notes || ''
    }));
  }

  function rowsForType(type, reports, fuelEntries, form) {
    if (type === 'monthlyShort') return summaryOnlyRows(reports);
    if (REPORT_TYPES.has(type)) return reportRows(reports);
    if (type === 'incomingFuel') return fuelIncomingRows(fuelEntries);
    if (type === 'consumedFuel') return reports.map(report => ({
      'التاريخ': dateText(report.reportDate),
      'عنوان التقرير': report.title || '',
      'الوقود المستهلك / لتر': report.fuel?.consumedDaily || '',
      'الرصيد السابق / لتر': report.fuel?.previousBalance || '',
      'الرصيد الحالي / لتر': report.fuel?.currentBalance || '',
      'الفاقد / لتر': report.fuel?.loss || ''
    }));
    if (type === 'fuelSummary') {
      const incoming = (fuelEntries || []).reduce((sum, item) => sum + n(item.quantityLiters ?? item.quantity), 0);
      const consumed = (reports || []).reduce((sum, report) => sum + n(report.fuel?.consumedDaily), 0);
      const municipal = (reports || []).reduce((sum, report) => sum + n(report.fuel?.municipalSupplied), 0);
      return [{
        'إجمالي الوقود الوارد / لتر': prettyNumber(incoming),
        'إجمالي الوقود المستهلك / لتر': prettyNumber(consumed),
        'إجمالي مورد البلدية من التقارير / لتر': prettyNumber(municipal),
        'الصافي التقديري / لتر': prettyNumber(incoming + municipal - consumed)
      }];
    }
    if (type === 'producedWater') return reports.map(report => ({
      'التاريخ': dateText(report.reportDate),
      'عنوان التقرير': report.title || '',
      'الإنتاج اليومي / كوب': report.water?.dailyProduction || '',
      'العادم / كوب': report.water?.rejectWater || '',
      'نسبة الفاقد %': report.water?.lossPercentage || ''
    }));
    if (['deliveredWater', 'beneficiaries', 'beneficiaryOne'].includes(type)) {
      return beneficiaryRows(reports, String(form.get('beneficiary') || '').trim());
    }
    return reportRows(reports);
  }

  function autoWidth(ws, rows) {
    const headers = Object.keys(rows[0] || {});
    ws['!cols'] = headers.map(header => {
      const max = Math.max(String(header).length, ...rows.map(row => String(row[header] ?? '').length), 8);
      return { wch: Math.min(max + 2, 34) };
    });
    ws['!dir'] = 'rtl';
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length, 1), c: Math.max(headers.length - 1, 0) } }) };
  }

  function exportExcelVisible(rows, filename) {
    if (!window.XLSX) throw new Error('مكتبة Excel لم يتم تحميلها.');
    const finalRows = rows.length ? rows : [{ 'ملاحظة': 'لا توجد بيانات للتصدير' }];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(finalRows, { skipHeader: false });
    autoWidth(ws, finalRows);
    XLSX.utils.book_append_sheet(wb, ws, 'التقارير');
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.writeFile(wb, cleanName(filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`));
  }

  function exportPdfVisible(rows, title) {
    const finalRows = rows.length ? rows : [{ 'ملاحظة': 'لا توجد بيانات للتصدير' }];
    const headers = Object.keys(finalRows[0] || {});
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Tahoma,Arial;direction:rtl;padding:20px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #999;padding:6px;text-align:right;vertical-align:top}th{background:#eef6f2}</style></head><body><h1>${title}</h1><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${finalRows.map(row => `<tr>${headers.map(h => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table><script>print()<\/script></body></html>`;
    const win = window.open('', '_blank');
    if (!win) throw new Error('المتصفح منع فتح نافذة PDF. اسمح بالنوافذ المنبثقة.');
    win.document.write(html);
    win.document.close();
  }

  async function fetchReportsFresh() {
    try {
      const snap = await firebase.firestore().collection('reports').orderBy('reportDate', 'desc').get();
      const reports = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      window.__WATER_REPORTS_CACHE__ = reports;
      return reports;
    } catch (error) {
      console.warn('Using cached reports for export', error);
      return window.__WATER_REPORTS_CACHE__ || [];
    }
  }

  async function fetchFuelFresh() {
    try {
      const snap = await firebase.firestore().collection('fuelEntries').orderBy('date', 'desc').get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.warn('Using cached fuel entries for export', error);
      return window.WaterFuelRawEntries || [];
    }
  }

  function inRange(date, from, to) {
    if (!date) return false;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  function filterReportsByForm(reports, form, type) {
    if (type === 'dailyFull') {
      const day = String(form.get('specificDay') || new Date().toISOString().slice(0, 10));
      return reports.filter(report => report.reportDate === day);
    }
    if (type === 'monthlyFull' || type === 'monthlyShort') {
      const month = String(form.get('month') || new Date().toISOString().slice(0, 7));
      return reports.filter(report => String(report.reportDate || '').startsWith(month));
    }
    const from = String(form.get('fromDate') || '0000-01-01');
    const to = String(form.get('toDate') || '9999-12-31');
    return reports.filter(report => inRange(report.reportDate, from, to));
  }

  function selectedType() {
    return window.__WATER_SELECTED_EXPORT_TYPE || 'allReports';
  }

  async function executeVisibleExport() {
    const formElement = document.getElementById('exportCenterForm');
    if (!formElement) throw new Error('افتح مركز التصدير أولًا.');
    const form = new FormData(formElement);
    const type = selectedType();
    const label = LABELS[type] || 'تصدير التقارير';
    const fileType = String(form.get('fileType') || 'excel');
    const allReports = await fetchReportsFresh();
    const reports = filterReportsByForm(allReports, form, type).map(recalc);
    const from = String(form.get('fromDate') || '0000-01-01');
    const to = String(form.get('toDate') || '9999-12-31');
    const fuelEntries = (await fetchFuelFresh()).filter(item => inRange(item.date, from, to));
    const rows = rowsForType(type, reports, fuelEntries, form);
    if (!rows.length) throw new Error('لا توجد بيانات ضمن الفلاتر المحددة. غيّر التاريخ أو نوع التقرير.');
    if (fileType === 'pdf') exportPdfVisible(rows, `${label} - نظام تقارير تشغيل وضخ المياه`);
    else exportExcelVisible(rows, `${label}.xlsx`);
  }

  function patch() {
    if (!window.WaterFuel || window.WaterFuel.__visibleExportFixPatched) return;
    const oldSetType = window.WaterFuel.setExportType;
    window.WaterFuel.setExportType = function fixedSetExportType(type) {
      window.__WATER_SELECTED_EXPORT_TYPE = type;
      return oldSetType?.call(window.WaterFuel, type);
    };
    window.WaterFuel.executeExport = async function fixedExecuteExport() {
      try {
        await executeVisibleExport();
      } catch (error) {
        console.error('Visible export failed', error);
        alert(`فشل التصدير: ${error.message || error}`);
      }
    };
    window.WaterFuel.__visibleExportFixPatched = true;
  }

  function boot() { patch(); }

  window.ReportExportVisibleFix = { boot, executeVisibleExport, exportExcelVisible, reportRows };
  window.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', boot);
  setTimeout(boot, 300);
  setTimeout(boot, 1200);
})();
