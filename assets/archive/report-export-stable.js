(() => {
  const REPORT_EXPORT_TYPES = new Set(['allReports', 'dailyFull', 'monthlyFull', 'monthlyShort', 'customReport']);

  const EXPORT_LABELS = {
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

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function safeFileName(value) {
    return String(value || 'export').replace(/[\\/:*?"<>|]/g, '-').slice(0, 90);
  }

  function number(value) {
    if (window.ReportUtils?.number) return window.ReportUtils.number(value);
    const n = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function formatNumber(value, digits = 2) {
    const n = number(value);
    const r = +n.toFixed(digits);
    return Number.isInteger(r) ? r : r;
  }

  function clone(value) {
    try { return structuredClone(value); }
    catch { return JSON.parse(JSON.stringify(value || {})); }
  }

  function normalizeReport(report) {
    try {
      return window.ReportUtils?.recalc ? window.ReportUtils.recalc(clone(report || {})) : clone(report || {});
    } catch (error) {
      console.warn('Report normalization failed', error);
      return clone(report || {});
    }
  }

  function displayDate(value) {
    return window.ReportUtils?.displayDate ? window.ReportUtils.displayDate(value) : (value || '');
  }

  function displayTime(value) {
    return window.ReportUtils?.displayTimeArabic?.(value) || value || '';
  }

  function getFirstPeriod(report) {
    return report?.generator?.periods?.[0] || {};
  }

  function detailedReportRows(reports) {
    const cleanReports = (reports || []).map(normalizeReport).filter(r => r.reportDate || r.title);
    const maxBeneficiaries = Math.max(1, ...cleanReports.map(r => (r.beneficiaries || []).length));
    return cleanReports.map((report, index) => {
      const period = getFirstPeriod(report);
      const row = {
        'م': index + 1,
        'التاريخ': displayDate(report.reportDate),
        'التاريخ الخام': report.reportDate || '',
        'عنوان التقرير': report.title || '',
        'المحطة': report.stationName || '',
        'البئر': report.wellName || '',
        'المشغل': report.operatorName || report.generator?.operatorName || '',
        'بداية التشغيل': displayTime(period.startTime),
        'وقت الإيقاف': displayTime(period.stopTime),
        'ساعات التشغيل': report.generator?.totalRunHours || '',
        'حالة المولد': report.generator?.status || '',
        'ملاحظات المولد': report.generator?.notes || '',
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
        const n = i + 1;
        row[`الجهة ${n}`] = beneficiary.name || '';
        row[`كمية الجهة ${n} / كوب`] = beneficiary.quantity || '';
        row[`سيارات الجهة ${n}`] = beneficiary.cars || '';
        row[`ملاحظات الجهة ${n}`] = beneficiary.notes || '';
      }
      return row;
    });
  }

  function summaryRows(reports) {
    const list = (reports || []).map(normalizeReport).filter(r => r.reportDate || r.title);
    let totals = {};
    try { totals = window.ReportUtils?.summary ? window.ReportUtils.summary(list) : {}; } catch {}
    return [
      ['نظام تقارير تشغيل وضخ المياه'],
      ['تاريخ التصدير', new Date().toLocaleString('ar')],
      ['عدد التقارير', list.length],
      ['إجمالي ساعات التشغيل', totals.runHours ?? ''],
      ['إجمالي الوقود المستهلك / لتر', totals.fuelConsumed ?? ''],
      ['إجمالي الوقود المورد / لتر', totals.fuelSupplied ?? ''],
      ['إجمالي الإنتاج / كوب', totals.waterProduction ?? ''],
      ['إجمالي العادم / كوب', totals.rejectWater ?? ''],
      ['إجمالي المياه المعبأة / كوب', totals.filledWater ?? ''],
      ['إجمالي السيارات', totals.cars ?? ''],
      ['نسبة الفاقد %', totals.lossPercentage ?? '']
    ];
  }

  function autoFit(ws, aoa) {
    const maxCols = Math.max(1, ...aoa.map(row => row.length));
    ws['!cols'] = Array.from({ length: maxCols }, (_, column) => {
      const width = Math.max(8, ...aoa.map(row => String(row[column] ?? '').length));
      return { wch: Math.min(width + 2, 36) };
    });
    ws['!dir'] = 'rtl';
  }

  function exportRowsToExcel(rows, filename, summary = []) {
    if (!window.XLSX) throw new Error('مكتبة Excel غير محملة.');
    const finalRows = rows.length ? rows : [{ 'ملاحظة': 'لا توجد بيانات ضمن الفلاتر المحددة' }];
    const headers = Object.keys(finalRows[0]);
    const aoa = [
      ...(summary.length ? summary : []),
      ...(summary.length ? [[]] : []),
      ['جدول البيانات'],
      headers,
      ...finalRows.map(row => headers.map(header => row[header] ?? ''))
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headerRowIndex = summary.length ? summary.length + 2 : 1;
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headerRowIndex, c: 0 }, e: { r: aoa.length - 1, c: headers.length - 1 } }) };
    ws['!merges'] = [{ s: { r: summary.length ? summary.length + 1 : 0, c: 0 }, e: { r: summary.length ? summary.length + 1 : 0, c: Math.min(headers.length - 1, 8) } }];
    autoFit(ws, aoa);
    XLSX.utils.book_append_sheet(wb, ws, 'التقارير');
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.writeFile(wb, safeFileName(filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`));
  }

  function exportRowsToPdf(rows, title, summary = []) {
    const finalRows = rows.length ? rows : [{ 'ملاحظة': 'لا توجد بيانات ضمن الفلاتر المحددة' }];
    const headers = Object.keys(finalRows[0]);
    const summaryHtml = summary.length ? `<table><tbody>${summary.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Tahoma,Arial;direction:rtl;padding:24px;line-height:1.8}h1{margin:0 0 16px}table{border-collapse:collapse;width:100%;margin:14px 0;font-size:12px}th,td{border:1px solid #999;padding:7px;text-align:right;vertical-align:top}th{background:#eef6f2}@media print{button{display:none}}</style></head><body><h1>${esc(title)}</h1>${summaryHtml}<table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${finalRows.map(row => `<tr>${headers.map(h => `<td>${esc(row[h])}</td>`).join('')}</tr>`).join('')}</tbody></table><script>print()<\/script></body></html>`;
    const win = window.open('', '_blank');
    if (!win) throw new Error('المتصفح منع فتح نافذة PDF. اسمح بالنوافذ المنبثقة.');
    win.document.write(html);
    win.document.close();
  }

  async function fetchReports() {
    const cached = window.__WATER_REPORTS_CACHE__ || [];
    try {
      const snapshot = await firebase.firestore().collection('reports').orderBy('reportDate', 'desc').get();
      const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      window.__WATER_REPORTS_CACHE__ = reports;
      return reports;
    } catch (error) {
      console.warn('Export used cached reports because Firestore fetch failed', error);
      return cached;
    }
  }

  async function fetchFuelEntries() {
    try {
      const snapshot = await firebase.firestore().collection('fuelEntries').orderBy('date', 'desc').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.warn('Fuel export fetch failed', error);
      return window.WaterFuelRawEntries || [];
    }
  }

  function inRange(date, from, to) {
    if (!date) return false;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  function filteredReports(reports, form, type) {
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

  function simpleRows(type, reports, fuelEntries, form) {
    const beneficiaryName = String(form.get('beneficiary') || '').trim();
    if (REPORT_EXPORT_TYPES.has(type)) return detailedReportRows(reports);
    if (type === 'incomingFuel') return fuelEntries.map(item => ({ 'التاريخ': item.date || '', 'اليوم': item.day || '', 'الساعة': item.time || '', 'المورد': item.supplier || item.donor || '', 'الكمية لتر': item.quantityLiters ?? item.quantity ?? '', 'طريقة التعبئة': item.fillingMethod || '', 'المسلّم': item.deliveredBy || '', 'ملاحظات': item.notes || '' }));
    if (type === 'consumedFuel') return reports.map(report => ({ 'التاريخ': displayDate(report.reportDate), 'العنوان': report.title || '', 'الوقود المستهلك': report.fuel?.consumedDaily || '', 'الرصيد السابق': report.fuel?.previousBalance || '', 'الرصيد الحالي': report.fuel?.currentBalance || '', 'الفاقد': report.fuel?.loss || '' }));
    if (type === 'fuelSummary') {
      const incoming = fuelEntries.reduce((sum, item) => sum + number(item.quantityLiters ?? item.quantity), 0);
      const consumed = reports.reduce((sum, report) => sum + number(report.fuel?.consumedDaily), 0);
      const municipal = reports.reduce((sum, report) => sum + number(report.fuel?.municipalSupplied), 0);
      return [{ 'إجمالي الوقود الوارد': formatNumber(incoming), 'إجمالي الوقود المستهلك': formatNumber(consumed), 'إجمالي مورد البلدية من التقارير': formatNumber(municipal), 'صافي تقديري': formatNumber(incoming + municipal - consumed) }];
    }
    if (type === 'producedWater') return reports.map(report => ({ 'التاريخ': displayDate(report.reportDate), 'العنوان': report.title || '', 'الإنتاج اليومي': report.water?.dailyProduction || '', 'العادم': report.water?.rejectWater || '', 'نسبة الفاقد': report.water?.lossPercentage || '' }));
    if (['deliveredWater', 'beneficiaries', 'beneficiaryOne'].includes(type)) {
      return reports.flatMap(report => (report.beneficiaries || [])
        .filter(b => type !== 'beneficiaryOne' || !beneficiaryName || String(b.name || '').includes(beneficiaryName))
        .map(b => ({ 'التاريخ': displayDate(report.reportDate), 'العنوان': report.title || '', 'الجهة': b.name || '', 'الكمية': b.quantity || '', 'السيارات': b.cars || '', 'ملاحظات': b.notes || '' })));
    }
    return detailedReportRows(reports);
  }

  function currentExportType() {
    const activeButton = document.querySelector('#exportCenterSection .export-group .btn.active');
    const activeText = activeButton?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const match = Object.entries(EXPORT_LABELS).find(([, label]) => activeText.includes(label));
    return window.__WATER_SELECTED_EXPORT_TYPE || match?.[0] || 'allReports';
  }

  async function executeStableExport() {
    const formElement = document.getElementById('exportCenterForm');
    if (!formElement) throw new Error('نموذج التصدير غير ظاهر. افتح مركز التصدير أولًا.');
    const form = new FormData(formElement);
    const type = currentExportType();
    const label = EXPORT_LABELS[type] || 'تصدير التقارير';
    const fileType = String(form.get('fileType') || 'excel');
    const allReports = (await fetchReports()).map(normalizeReport);
    const reports = filteredReports(allReports, form, type);
    const from = String(form.get('fromDate') || '0000-01-01');
    const to = String(form.get('toDate') || '9999-12-31');
    const fuelEntries = (await fetchFuelEntries()).filter(item => inRange(item.date, from, to));
    const rows = simpleRows(type, reports, fuelEntries, form);
    const title = `${label} - نظام تقارير تشغيل وضخ المياه`;

    if (!rows.length) throw new Error('لا توجد بيانات ضمن الفلاتر المحددة. غيّر التاريخ أو نوع التقرير.');
    if (fileType === 'pdf') exportRowsToPdf(rows, title, REPORT_EXPORT_TYPES.has(type) ? summaryRows(reports) : []);
    else exportRowsToExcel(rows, `${label}.xlsx`, REPORT_EXPORT_TYPES.has(type) ? summaryRows(reports) : []);
  }

  function patchWaterFuelExport() {
    if (!window.WaterFuel || window.WaterFuel.__stableReportExportPatched) return;
    const originalSetType = window.WaterFuel.setExportType;
    window.WaterFuel.setExportType = function patchedSetExportType(type) {
      window.__WATER_SELECTED_EXPORT_TYPE = type;
      return originalSetType?.call(window.WaterFuel, type);
    };
    const originalOpen = window.WaterFuel.openExportCenter;
    window.WaterFuel.openExportCenter = function patchedOpenExportCenter(...args) {
      const result = originalOpen?.apply(window.WaterFuel, args);
      setTimeout(() => {
        if (!window.__WATER_SELECTED_EXPORT_TYPE) window.__WATER_SELECTED_EXPORT_TYPE = 'allReports';
      }, 30);
      return result;
    };
    window.WaterFuel.executeExport = async function patchedExecuteExport() {
      try {
        await executeStableExport();
        const message = document.createElement('div');
        message.className = 'fuel-toast ok show';
        message.textContent = 'تم تجهيز التصدير بنجاح';
        document.body.appendChild(message);
        setTimeout(() => message.remove(), 2500);
      } catch (error) {
        console.error('Stable export failed', error);
        alert(`فشل التصدير: ${error.message || error}`);
      }
    };
    window.WaterFuel.__stableReportExportPatched = true;
  }

  function boot() {
    patchWaterFuelExport();
  }

  window.ReportExportStable = { boot, executeStableExport, detailedReportRows };
  window.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', boot);
  setTimeout(boot, 300);
  setTimeout(boot, 1200);
})();
