(() => {
  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function safeFileName(name) {
    return String(name || 'water-report').replace(/[\\/:*?"<>|]/g, '-').slice(0, 90);
  }

  function normalizeReport(report) {
    if (!window.ReportUtils?.recalc) return structuredClone(report || {});
    return window.ReportUtils.recalc(structuredClone(report || {}));
  }

  function timeValue(value) {
    return window.ReportUtils.displayTimeArabic?.(value) || value || '';
  }

  function buildFlatRows(reports) {
    const list = (reports || []).map(normalizeReport).filter(r => r.title || r.reportDate);
    const maxBeneficiaries = Math.max(1, ...list.map(r => (r.beneficiaries || []).length));

    return list.map((r, index) => {
      const row = {
        'م': index + 1,
        'التاريخ': window.ReportUtils?.displayDate ? window.ReportUtils.displayDate(r.reportDate) : (r.reportDate || ''),
        'عنوان التقرير': r.title || '',
        'المحطة': r.stationName || '',
        'البئر': r.wellName || '',
        'المشغل': r.operatorName || r.generator?.operatorName || '',
        'بداية التشغيل': window.ReportUtils?.displayTimeArabic?.(r.generator?.periods?.[0]?.startTime) || r.generator?.periods?.[0]?.startTime || '',
        'وقت الإيقاف': window.ReportUtils?.displayTimeArabic?.(r.generator?.periods?.[0]?.stopTime) || r.generator?.periods?.[0]?.stopTime || '',
        'ساعات التشغيل': r.generator?.totalRunHours || '',
        'حالة المولد': r.generator?.status || '',
        'ملاحظات المولد': r.generator?.notes || '',
        'الوقود المضاف يوميًا / لتر': r.fuel?.addedDaily || '',
        'الوقود المستهلك / لتر': r.fuel?.consumedDaily || '',
        'المورد من البلدية / لتر': r.fuel?.municipalSupplied || '',
        'الرصيد السابق / لتر': r.fuel?.previousBalance || '',
        'الرصيد الحالي / لتر': r.fuel?.currentBalance || '',
        'فرق/فاقد الوقود / لتر': r.fuel?.loss || '',
        'إنتاج الغاطس كوب/ساعة': r.water?.submersibleRate || '',
        'بعد الفلترة كوب/ساعة': r.water?.filteredRate || '',
        'الإنتاج اليومي / كوب': r.water?.dailyProduction || '',
        'العادم / كوب': r.water?.rejectWater || '',
        'نسبة الفاقد %': r.water?.lossPercentage || '',
        'المياه المعبأة / كوب': r.water?.filledWater || '',
        'عدد السيارات': r.water?.carsCount || '',
        'متوسط السيارة / كوب': r.water?.averagePerCar || '',
        'PH بعد التحلية': r.tests?.phAfterDesalination || '',
        'PH مياه الغاطس': r.tests?.phWellWater || '',
        'TDS مياه محلاة': r.tests?.tdsDesalinated || '',
        'TDS البئر': r.tests?.tdsWell || '',
        'TDS العادم': r.tests?.tdsReject || '',
        'الكلور الحر': r.tests?.freeChlorine || '',
        'عدد التنبيهات': (r.warnings || []).length,
        'التنبيهات': (r.warnings || []).join(' | '),
        'ملاحظات عامة': r.generalNotes || r.notes || ''
      };

      for (let i = 0; i < maxBeneficiaries; i += 1) {
        const b = r.beneficiaries?.[i] || {};
        const n = i + 1;
        row[`الجهة ${n}`] = b.name || '';
        row[`كمية الجهة ${n} / كوب`] = b.quantity || '';
        row[`سيارات الجهة ${n}`] = b.cars || '';
        row[`ملاحظات الجهة ${n}`] = b.notes || '';
      }

      return row;
    });
  }

  function buildSummaryRows(reports) {
    const list = (reports || []).map(normalizeReport).filter(r => r.title || r.reportDate);
    const totals = window.ReportUtils.summary(list);
    return [
      ['نظام تقارير تشغيل وضخ المياه'],
      ['تاريخ التصدير', new Date().toLocaleString('ar')],
      ['عدد التقارير', list.length],
      ['إجمالي ساعات التشغيل', totals.runHours],
      ['إجمالي الوقود المستهلك / لتر', totals.fuelConsumed],
      ['إجمالي الوقود المورد / لتر', totals.fuelSupplied],
      ['إجمالي الإنتاج / كوب', totals.waterProduction],
      ['إجمالي العادم / كوب', totals.rejectWater],
      ['إجمالي المياه المعبأة / كوب', totals.filledWater],
      ['إجمالي السيارات', totals.cars],
      ['متوسط الإنتاج اليومي', totals.averageDailyProduction],
      ['متوسط الوقود المستهلك', totals.averageFuelConsumption],
      ['نسبة الفاقد %', totals.lossPercentage]
    ];
  }

  function autoFit(ws, aoa) {
    const maxCols = Math.max(...aoa.map(row => row.length));
    ws['!cols'] = Array.from({ length: maxCols }, (_, col) => {
      const width = Math.max(...aoa.map(row => String(row[col] ?? '').length), 8);
      return { wch: Math.min(width + 2, 34) };
    });
    ws['!dir'] = 'rtl';
  }

  function exportXlsx(reports, filename = 'تقارير تشغيل وضخ المياه.xlsx') {
    if (!window.XLSX) throw new Error('مكتبة Excel لم يتم تحميلها.');
    const cleanReports = (reports || []).map(normalizeReport).filter(r => r.title || r.reportDate);
    if (!cleanReports.length) throw new Error('لا توجد بيانات للتصدير.');

    const flatRows = buildFlatRows(cleanReports);
    const headers = Object.keys(flatRows[0] || {});
    const summaryRows = buildSummaryRows(cleanReports);
    const aoa = [
      ...summaryRows,
      [],
      ['جدول التقارير التفصيلي - كل البيانات في شيت واحد'],
      headers,
      ...flatRows.map(row => headers.map(header => row[header] ?? ''))
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: Math.min(headers.length - 1, 6) } },
      { s: { r: summaryRows.length + 1, c: 0 }, e: { r: summaryRows.length + 1, c: Math.min(headers.length - 1, 6) } }
    ];
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: summaryRows.length + 2, c: 0 }, e: { r: aoa.length - 1, c: headers.length - 1 } }) };
    autoFit(ws, aoa);
    XLSX.utils.book_append_sheet(wb, ws, 'التقارير');
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.writeFile(wb, safeFileName(filename));
  }

  function toCsv(rows) {
    const headers = Object.keys(rows[0] || {});
    const clean = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    return '\ufeff' + [headers.map(clean).join(','), ...rows.map(row => headers.map(h => clean(row[h])).join(','))].join('\n');
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFileName(filename);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCsv(reports, filename = 'تقارير تشغيل وضخ المياه.csv') {
    const rows = buildFlatRows(reports);
    if (!rows.length) throw new Error('لا توجد بيانات للتصدير.');
    downloadBlob(toCsv(rows), filename, 'text/csv;charset=utf-8');
  }

  function exportHtml(reports, filename = 'تقرير تشغيل وضخ المياه.html') {
    const rows = buildFlatRows(reports);
    if (!rows.length) throw new Error('لا توجد بيانات للتصدير.');
    const headers = Object.keys(rows[0] || {});
    const summary = buildSummaryRows(reports);
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير تشغيل وضخ المياه</title><style>body{font-family:Tahoma,Arial;padding:24px;direction:rtl}table{border-collapse:collapse;width:100%;margin:16px 0}th,td{border:1px solid #999;padding:8px;text-align:right;vertical-align:top}th{background:#e8f5ef}h1{margin:0 0 12px}</style></head><body><h1>تقرير تشغيل وضخ المياه</h1><table><tbody>${summary.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${headers.map(h => `<td>${esc(row[h])}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
    downloadBlob(html, filename, 'text/html;charset=utf-8');
  }

  function openExportDialog(reports, title = 'تصدير التقرير') {
    const cleanReports = (reports || []).map(normalizeReport).filter(r => r.title || r.reportDate);
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay export-overlay show';
    overlay.innerHTML = `<div class="confirm-card export-card"><div class="confirm-icon">📤</div><h3>${esc(title)}</h3><p>سيتم تصدير Excel في شيت واحد فقط باسم: التقارير. البدائل: CSV وHTML ونسخ النص.</p><div class="export-actions"><button class="btn primary" data-export="xlsx">📊 Excel - شيت واحد</button><button class="btn" data-export="csv">📄 CSV</button><button class="btn" data-export="html">🌐 HTML</button><button class="btn" data-export="copy">📋 نسخ النص</button><button class="btn" data-export="close">إغلاق</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', async event => {
      const action = event.target?.dataset?.export;
      if (!action && event.target !== overlay) return;
      try {
        if (event.target === overlay || action === 'close') return overlay.remove();
        if (!cleanReports.length) throw new Error('لا توجد تقارير للتصدير.');
        if (action === 'xlsx') exportXlsx(cleanReports, cleanReports.length === 1 ? `${cleanReports[0].title}.xlsx` : 'تقارير تشغيل وضخ المياه.xlsx');
        if (action === 'csv') exportCsv(cleanReports, cleanReports.length === 1 ? `${cleanReports[0].title}.csv` : 'تقارير تشغيل وضخ المياه.csv');
        if (action === 'html') exportHtml(cleanReports, cleanReports.length === 1 ? `${cleanReports[0].title}.html` : 'تقارير تشغيل وضخ المياه.html');
        if (action === 'copy') await navigator.clipboard.writeText(cleanReports.map(r => window.ReportUtils.whatsappText(r)).join('\n\n----------------\n\n'));
        overlay.remove();
      } catch (error) {
        alert(`فشل التصدير: ${error.message}`);
      }
    });
  }

  function patchReportsCache() {
    if (!window.FirebaseService || window.FirebaseService.__exportPatched) return;
    const originalListen = window.FirebaseService.listenReports;
    window.FirebaseService.listenReports = function patchedListenReports(callback) {
      return originalListen.call(window.FirebaseService, reports => {
        window.__WATER_REPORTS_CACHE__ = reports || [];
        callback(reports);
      });
    };
    window.FirebaseService.__exportPatched = true;
  }

  function patchAppExports() {
    if (!window.App || window.App.__exportPatched) return;
    const originalOne = window.App.exportOneExcel;
    const originalAll = window.App.exportAllExcel;
    window.App.exportOneExcel = function patchedExportOneExcel(id) {
      const report = (window.__WATER_REPORTS_CACHE__ || []).find(item => item.id === id);
      if (!report) return originalOne?.(id);
      openExportDialog([report], 'تصدير التقرير');
    };
    window.App.exportAllExcel = function patchedExportAllExcel() {
      const reports = window.__WATER_REPORTS_CACHE__ || [];
      if (!reports.length) return originalAll?.();
      openExportDialog(reports, 'تصدير جميع التقارير');
    };
    window.App.__exportPatched = true;
  }

  patchReportsCache();
  window.addEventListener('DOMContentLoaded', () => setTimeout(patchAppExports, 0));

  window.ExportTools = { exportXlsx, exportCsv, exportHtml, openExportDialog, buildFlatRows };
})();
