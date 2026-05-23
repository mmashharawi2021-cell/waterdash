(() => {
  'use strict';

  const TYPES = {
    reportsAll: { title: 'تصدير التقارير بالكامل', group: 'التقارير', mode: 'all', data: 'reports' },
    reportsDaily: { title: 'تقرير يومي', group: 'التقارير', mode: 'daily', data: 'reports' },
    reportsWeekly: { title: 'تقرير أسبوعي', group: 'التقارير', mode: 'weekly', data: 'reports' },
    reportsMonthly: { title: 'تقرير شهري', group: 'التقارير', mode: 'monthly', data: 'reports' },
    reportsCustom: { title: 'تقرير مخصص', group: 'التقارير', mode: 'custom', data: 'reports' },
    fuelSummary: { title: 'ملخص الوقود', group: 'الوقود', mode: 'custom', data: 'fuelSummary' },
    incomingFuel: { title: 'الوقود الوارد', group: 'الوقود', mode: 'custom', data: 'incomingFuel' },
    consumedFuel: { title: 'الوقود المستهلك', group: 'الوقود', mode: 'custom', data: 'consumedFuel' },
    producedWater: { title: 'المياه المنتجة', group: 'المياه', mode: 'custom', data: 'producedWater' },
    deliveredWater: { title: 'المياه المعبأة للجهات', group: 'المياه', mode: 'custom', data: 'deliveredWater' },
    beneficiaries: { title: 'الجهات المستفيدة', group: 'الجهات', mode: 'custom', data: 'beneficiaries' },
    beneficiaryOne: { title: 'جهة مستفيدة محددة', group: 'الجهات', mode: 'custom', data: 'beneficiaryOne' }
  };

  const TYPE_ALIASES = {
    allReports: 'reportsAll',
    dailyFull: 'reportsDaily',
    weeklyFull: 'reportsWeekly',
    monthlyFull: 'reportsMonthly',
    monthlyShort: 'reportsMonthly',
    customReport: 'reportsCustom',
    fuel: 'fuelSummary'
  };

  const GROUPS = ['التقارير', 'الوقود', 'المياه', 'الجهات'];
  let selectedType = 'reportsAll';
  let lastStatus = '';

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
  }

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function currentMonth() {
    return today().slice(0, 7);
  }

  function toDate(value) {
    return new Date(`${value || today()}T12:00:00`);
  }

  function iso(date) {
    return date.toISOString().slice(0, 10);
  }

  function weekRange(baseDate) {
    const date = toDate(baseDate);
    const day = date.getDay();
    const diffToSaturday = (day + 1) % 7;
    const start = new Date(date);
    start.setDate(date.getDate() - diffToSaturday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: iso(start), to: iso(end) };
  }

  function number(value) {
    if (window.ReportUtils?.number) return window.ReportUtils.number(value);
    const parsed = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function fmt(value, digits = 2) {
    const n = number(value);
    const rounded = +n.toFixed(digits);
    return Number.isInteger(rounded) ? rounded : rounded;
  }

  function safeFileName(value) {
    return clean(value || 'تصدير').replace(/[\\/:*?"<>|]/g, '-').slice(0, 90);
  }

  function clone(value) {
    try { return structuredClone(value); }
    catch { return JSON.parse(JSON.stringify(value || {})); }
  }

  function recalc(report) {
    try { return window.ReportUtils?.recalc ? window.ReportUtils.recalc(clone(report || {})) : clone(report || {}); }
    catch (error) {
      console.warn('Export report recalc failed:', error);
      return clone(report || {});
    }
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

  function toast(message, type = 'info') {
    let host = document.getElementById('exportToastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'exportToastHost';
      document.body.appendChild(host);
    }
    const item = document.createElement('div');
    item.className = `export-toast ${type}`;
    item.textContent = message;
    host.appendChild(item);
    requestAnimationFrame(() => item.classList.add('show'));
    setTimeout(() => {
      item.classList.remove('show');
      setTimeout(() => item.remove(), 240);
    }, 3600);
  }

  function setStatus(message, type = '') {
    lastStatus = message || '';
    const host = document.getElementById('exportStatus');
    if (!host) return;
    host.className = `export-status ${type}`;
    host.textContent = lastStatus;
  }

  function getDb() {
    if (!window.firebase?.firestore) throw new Error('Firebase Firestore غير متاح.');
    window.FirebaseService?.init?.();
    return firebase.firestore();
  }

  async function fetchReports() {
    const snapshot = await getDb().collection('reports').orderBy('reportDate', 'desc').get();
    const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    window.__WATER_REPORTS_CACHE__ = reports;
    return reports;
  }

  async function fetchFuelEntries() {
    const snapshot = await getDb().collection('fuelEntries').orderBy('date', 'desc').get();
    const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    window.WaterFuelRawEntries = entries;
    return entries;
  }

  async function fetchFirestoreData() {
    const [reports, fuelEntries] = await Promise.all([fetchReports(), fetchFuelEntries()]);
    return { reports, fuelEntries };
  }

  function inRange(date, from, to) {
    if (!date) return false;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  function inputs() {
    return {
      fileType: document.getElementById('exportFileType')?.value || 'excel',
      day: document.getElementById('exportDay')?.value || today(),
      week: document.getElementById('exportWeek')?.value || today(),
      month: document.getElementById('exportMonth')?.value || currentMonth(),
      from: document.getElementById('exportFrom')?.value || '',
      to: document.getElementById('exportTo')?.value || today(),
      beneficiary: clean(document.getElementById('exportBeneficiary')?.value || '')
    };
  }

  function rangeFor(typeId) {
    const type = TYPES[typeId] || TYPES.reportsAll;
    const values = inputs();

    if (type.mode === 'all') return { from: '', to: '', label: 'كل البيانات', beneficiary: values.beneficiary };
    if (type.mode === 'daily') return { from: values.day, to: values.day, label: values.day, beneficiary: values.beneficiary };
    if (type.mode === 'weekly') {
      const range = weekRange(values.week);
      return { ...range, label: `${range.from} إلى ${range.to}`, beneficiary: values.beneficiary };
    }
    if (type.mode === 'monthly') return { from: `${values.month}-01`, to: `${values.month}-31`, label: values.month, beneficiary: values.beneficiary };
    return { from: values.from, to: values.to, label: `${values.from || 'البداية'} إلى ${values.to || 'النهاية'}`, beneficiary: values.beneficiary };
  }

  function filterReports(reports, typeId) {
    const type = TYPES[typeId] || TYPES.reportsAll;
    const range = rangeFor(typeId);
    const list = (reports || []).map(recalc).filter(report => report.reportDate || report.title);
    if (type.mode === 'all') return list;
    return list.filter(report => inRange(report.reportDate, range.from, range.to));
  }

  function filterFuel(fuelEntries, typeId) {
    const type = TYPES[typeId] || TYPES.reportsAll;
    const range = rangeFor(typeId);
    if (type.mode === 'all') return fuelEntries || [];
    return (fuelEntries || []).filter(item => inRange(item.date, range.from, range.to));
  }

  function reportRows(reports) {
    const list = (reports || []).map(recalc).filter(report => report.reportDate || report.title);
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
        'ملاحظات المولد': report.generator?.notes || '',
        'الوقود المضاف يوميًا / لتر': report.fuel?.addedDaily || '',
        'الوقود المستهلك / لتر': report.fuel?.consumedDaily || '',
        'المورد من البلدية / لتر': report.fuel?.municipalSupplied || '',
        'الرصيد السابق / لتر': report.fuel?.previousBalance || '',
        'الرصيد الحالي / لتر': report.fuel?.currentBalance || '',
        'فرق/فاقد الوقود / لتر': report.fuel?.loss || '',
        'إنتاج الغاطس كوب/ساعة': report.water?.submersibleRate || '',
        'بعد الفلترة كوب/ساعة': report.water?.filteredRate || '',
        'الإنتاج اليومي / كوب': report.water?.dailyProduction || '',
        'العادم / كوب': report.water?.rejectWater || '',
        'نسبة الفاقد %': report.water?.lossPercentage || '',
        'المياه المعبأة / كوب': report.water?.filledWater || '',
        'عدد السيارات': report.water?.carsCount || '',
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
        const item = report.beneficiaries?.[i] || {};
        const order = i + 1;
        row[`الجهة ${order}`] = item.name || '';
        row[`كمية الجهة ${order} / كوب`] = item.quantity || '';
        row[`سيارات الجهة ${order}`] = item.cars || '';
        row[`ملاحظات الجهة ${order}`] = item.notes || '';
      }

      return row;
    });
  }

  function incomingFuelRows(fuelEntries) {
    return (fuelEntries || []).map((item, index) => ({
      'م': index + 1,
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

  function consumedFuelRows(reports) {
    return (reports || []).map((report, index) => ({
      'م': index + 1,
      'التاريخ': dateText(report.reportDate),
      'عنوان التقرير': report.title || '',
      'الوقود المستهلك / لتر': report.fuel?.consumedDaily || '',
      'الرصيد السابق / لتر': report.fuel?.previousBalance || '',
      'الرصيد الحالي / لتر': report.fuel?.currentBalance || '',
      'فرق/فاقد الوقود / لتر': report.fuel?.loss || ''
    }));
  }

  function fuelSummaryRows(reports, fuelEntries) {
    const incoming = (fuelEntries || []).reduce((sum, item) => sum + number(item.quantityLiters ?? item.quantity), 0);
    const consumed = (reports || []).reduce((sum, report) => sum + number(report.fuel?.consumedDaily), 0);
    const municipal = (reports || []).reduce((sum, report) => sum + number(report.fuel?.municipalSupplied), 0);
    return [{
      'إجمالي الوقود الوارد / لتر': fmt(incoming),
      'إجمالي الوقود المستهلك / لتر': fmt(consumed),
      'إجمالي مورد البلدية من التقارير / لتر': fmt(municipal),
      'الصافي التقديري / لتر': fmt(incoming + municipal - consumed)
    }];
  }

  function producedWaterRows(reports) {
    return (reports || []).map((report, index) => ({
      'م': index + 1,
      'التاريخ': dateText(report.reportDate),
      'عنوان التقرير': report.title || '',
      'إنتاج الغاطس كوب/ساعة': report.water?.submersibleRate || '',
      'بعد الفلترة كوب/ساعة': report.water?.filteredRate || '',
      'الإنتاج اليومي / كوب': report.water?.dailyProduction || '',
      'العادم / كوب': report.water?.rejectWater || '',
      'نسبة الفاقد %': report.water?.lossPercentage || ''
    }));
  }

  function beneficiaryRows(reports, onlyOne = false) {
    const beneficiary = rangeFor(selectedType).beneficiary;
    return (reports || []).flatMap(report => (report.beneficiaries || [])
      .filter(item => !onlyOne || !beneficiary || String(item.name || '').includes(beneficiary))
      .map((item, index) => ({
        'م': index + 1,
        'التاريخ': dateText(report.reportDate),
        'عنوان التقرير': report.title || '',
        'الجهة': item.name || '',
        'الكمية / كوب': item.quantity || '',
        'عدد السيارات': item.cars || '',
        'ملاحظات': item.notes || ''
      })));
  }

  function buildExportResult(typeId, rawReports, rawFuelEntries) {
    selectedType = typeId;
    const type = TYPES[typeId] || TYPES.reportsAll;
    const reportList = filterReports(rawReports, typeId);
    const fuelList = filterFuel(rawFuelEntries, typeId);

    if (type.data === 'beneficiaryOne' && !rangeFor(typeId).beneficiary) {
      return { rows: [], count: 0, emptyReason: 'اكتب اسم الجهة أولًا قبل تصدير جهة محددة.' };
    }

    switch (type.data) {
      case 'reports': return { rows: reportRows(reportList), count: reportList.length };
      case 'fuelSummary': {
        const sourceCount = reportList.length + fuelList.length;
        return { rows: sourceCount ? fuelSummaryRows(reportList, fuelList) : [], count: sourceCount };
      }
      case 'incomingFuel': return { rows: incomingFuelRows(fuelList), count: fuelList.length };
      case 'consumedFuel': return { rows: consumedFuelRows(reportList), count: reportList.length };
      case 'producedWater': return { rows: producedWaterRows(reportList), count: reportList.length };
      case 'deliveredWater':
      case 'beneficiaries': {
        const rows = beneficiaryRows(reportList, false);
        return { rows, count: rows.length };
      }
      case 'beneficiaryOne': {
        const rows = beneficiaryRows(reportList, true);
        return { rows, count: rows.length };
      }
      default: return { rows: reportRows(reportList), count: reportList.length };
    }
  }

  function autoWidth(sheet, rows) {
    const headers = Object.keys(rows[0] || {});
    sheet['!cols'] = headers.map(header => {
      const width = Math.max(String(header).length, ...rows.map(row => String(row[header] ?? '').length), 8);
      return { wch: Math.min(width + 2, 38) };
    });
    sheet['!dir'] = 'rtl';
    if (headers.length) {
      sheet['!autofilter'] = {
        ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length, 1), c: headers.length - 1 } })
      };
    }
  }

  function exportExcel(typeId, rows) {
    if (!window.XLSX) throw new Error('مكتبة Excel غير محملة. تحقق من الاتصال بالإنترنت.');
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
    autoWidth(sheet, rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'التقارير');
    workbook.Workbook = { Views: [{ RTL: true }] };
    const type = TYPES[typeId] || TYPES.reportsAll;
    XLSX.writeFile(workbook, `${safeFileName(type.title)} - ${safeFileName(rangeFor(typeId).label)}.xlsx`);
  }

  function exportPdf(typeId, rows, popupWindow = null) {
    const headers = Object.keys(rows[0] || {});
    const type = TYPES[typeId] || TYPES.reportsAll;
    const title = `${type.title} - ${rangeFor(typeId).label}`;
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Tahoma,Arial;direction:rtl;padding:20px;line-height:1.7}h1{font-size:20px;margin:0 0 14px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #999;padding:6px;text-align:right;vertical-align:top}th{background:#eef6f2}@media print{body{padding:10mm}}</style></head><body><h1>${esc(title)}</h1><table><thead><tr>${headers.map(header => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${headers.map(header => `<td>${esc(row[header])}</td>`).join('')}</tr>`).join('')}</tbody></table><script>setTimeout(() => print(), 300)<\/script></body></html>`;
    const win = popupWindow || window.open('', '_blank');
    if (!win) throw new Error('المتصفح منع نافذة PDF. اسمح بالنوافذ المنبثقة.');
    win.document.write(html);
    win.document.close();
  }

  function setLoading(typeId, loading) {
    document.querySelectorAll(`[data-export-type="${typeId}"]`).forEach(button => {
      button.disabled = loading;
      if (loading) {
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = '<span>⏳</span><b>جاري التصدير...</b><small>يرجى الانتظار</small>';
      } else {
        button.innerHTML = button.dataset.originalText || button.innerHTML;
      }
    });
  }

  async function download(typeId = selectedType) {
    const resolved = TYPE_ALIASES[typeId] || typeId;
    if (!TYPES[resolved]) {
      toast('نوع التصدير غير معروف.', 'error');
      setStatus('نوع التصدير غير معروف.', 'error');
      return;
    }

    selectedType = resolved;
    const fileType = inputs().fileType;

    try {
      setLoading(resolved, true);
      setStatus('جاري جلب البيانات من Firestore...', 'loading');
      toast('جاري جلب البيانات من Firestore...', 'info');

      const { reports, fuelEntries } = await fetchFirestoreData();
      setStatus('تم جلب البيانات. جاري تطبيق الفلتر...', 'loading');

      const result = buildExportResult(resolved, reports, fuelEntries);
      if (!result.count || !result.rows.length) {
        const message = result.emptyReason || 'لا توجد نتائج ضمن الفلتر المحدد. لم يتم إنشاء ملف فارغ.';
        setStatus(message, 'warning');
        toast(message, 'warning');
        return;
      }

      setStatus(`تم العثور على ${result.count} نتيجة. جاري إنشاء الملف...`, 'loading');
      if (fileType === 'pdf') {
        const pdfWindow = window.open('', '_blank');
        if (!pdfWindow) throw new Error('المتصفح منع نافذة PDF. اسمح بالنوافذ المنبثقة لهذا الموقع.');
        exportPdf(resolved, result.rows, pdfWindow);
      } else {
        exportExcel(resolved, result.rows);
      }

      const doneMessage = `تم إنشاء الملف بنجاح: ${result.rows.length} صف.`;
      setStatus(doneMessage, 'ok');
      toast(doneMessage, 'ok');
    } catch (error) {
      console.error('ExportCenter download failed:', error);
      const message = error.message || 'فشل التصدير.';
      setStatus(message, 'error');
      toast(message, 'error');
    } finally {
      setLoading(resolved, false);
    }
  }

  function button(typeId) {
    const type = TYPES[typeId];
    const active = typeId === selectedType ? ' active' : '';
    return `<button type="button" class="export-card-btn${active}" data-export-type="${typeId}" onclick="ExportCenter.download('${typeId}')"><span>⬇️</span><b>${esc(type.title)}</b><small>تحميل مباشر</small></button>`;
  }

  function render() {
    const section = ensureSection();
    section.className = 'export-center-section official-export-center';
    section.style.display = 'block';
    section.innerHTML = `
      <div class="official-export-head">
        <div><p class="eyebrow">مركز التصدير</p><h2>تصدير مباشر مصنّف</h2><small>كل زر يجلب البيانات من Firestore، يطبق الفلتر، يفحص عدد النتائج، ثم ينشئ الملف مباشرة.</small></div>
        <button class="btn" type="button" onclick="ExportCenter.close()">إغلاق</button>
      </div>
      <div class="official-export-filters">
        <label>نوع الملف<select id="exportFileType"><option value="excel">Excel</option><option value="pdf">PDF</option></select></label>
        <label>اليوم<input id="exportDay" type="date" value="${today()}"></label>
        <label>الأسبوع حسب تاريخ<input id="exportWeek" type="date" value="${today()}"></label>
        <label>الشهر<input id="exportMonth" type="month" value="${currentMonth()}"></label>
        <label>من تاريخ<input id="exportFrom" type="date"></label>
        <label>إلى تاريخ<input id="exportTo" type="date" value="${today()}"></label>
        <label class="wide">اسم جهة محددة<input id="exportBeneficiary" placeholder="اختياري لتصدير جهة محددة"></label>
      </div>
      <div id="exportStatus" class="export-status">${esc(lastStatus)}</div>
      <div class="official-export-groups">
        ${GROUPS.map(group => `<article class="official-export-group"><h3>${esc(group)}</h3><div>${Object.keys(TYPES).filter(typeId => TYPES[typeId].group === group).map(button).join('')}</div></article>`).join('')}
      </div>`;
  }

  function ensureSection() {
    let section = document.getElementById('exportCenterSection');
    if (!section) {
      const anchor = document.getElementById('incomingFuelSection') || document.querySelector('.stats.dashboard-totals') || document.querySelector('.app-shell');
      section = document.createElement('section');
      section.id = 'exportCenterSection';
      (anchor?.parentElement || document.body).insertBefore(section, anchor?.nextSibling || null);
    }
    return section;
  }

  function open(typeId) {
    selectedType = TYPE_ALIASES[typeId] || typeId || selectedType || 'reportsAll';
    render();
    setTimeout(() => document.getElementById('exportCenterSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function close() {
    const section = document.getElementById('exportCenterSection');
    if (section) section.style.display = 'none';
  }

  function setExportType(typeId) {
    selectedType = TYPE_ALIASES[typeId] || typeId || selectedType;
    if (document.getElementById('exportCenterSection')?.style.display !== 'none') render();
  }

  function injectStyles() {
    if (document.getElementById('officialExportCenterStyles')) return;
    const style = document.createElement('style');
    style.id = 'officialExportCenterStyles';
    style.textContent = `
      .official-export-center{display:block;padding:18px;border-radius:24px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);backdrop-filter:blur(18px);box-shadow:0 18px 50px rgba(0,0,0,.12)}
      .official-export-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}
      .official-export-filters{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:12px}
      .official-export-filters label{display:grid;gap:6px;font-weight:800;font-size:12px}
      .official-export-filters input,.official-export-filters select{min-height:42px;border-radius:13px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:inherit;padding:8px 10px;font-family:inherit}
      .official-export-filters .wide{grid-column:span 2}
      .export-status{min-height:32px;margin:8px 0 14px;padding:8px 12px;border-radius:13px;background:rgba(255,255,255,.06);color:var(--muted,#9fb0c3);font-weight:800}
      .export-status.ok{color:#bbf7d0;background:rgba(22,163,74,.13)}.export-status.error{color:#fecaca;background:rgba(220,38,38,.16)}.export-status.loading{color:#bfdbfe;background:rgba(59,130,246,.14)}.export-status.warning{color:#fde68a;background:rgba(245,158,11,.16)}
      .official-export-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .official-export-group{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.055);padding:14px}
      .official-export-group h3{margin:0 0 12px;font-size:16px}
      .official-export-group>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .export-card-btn{min-height:72px;border:1px solid rgba(52,211,153,.22);border-radius:16px;background:linear-gradient(135deg,rgba(15,23,42,.75),rgba(16,185,129,.14));color:inherit;font-family:inherit;text-align:right;padding:10px 12px;cursor:pointer;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:3px 8px;transition:transform .16s ease,border-color .16s ease}
      .export-card-btn:hover{transform:translateY(-1px);border-color:rgba(52,211,153,.42)}.export-card-btn.active{outline:2px solid rgba(56,189,248,.5)}.export-card-btn:disabled{opacity:.62;cursor:wait}.export-card-btn span{grid-row:span 2}.export-card-btn b{font-size:14px}.export-card-btn small{color:var(--muted,#9fb0c3)}
      #exportToastHost{position:fixed;left:18px;bottom:18px;z-index:20000;display:grid;gap:8px;max-width:min(430px,calc(100vw - 36px))}.export-toast{padding:12px 14px;border-radius:15px;background:rgba(15,23,42,.94);color:#fff;box-shadow:0 16px 38px rgba(0,0,0,.25);opacity:0;transform:translateY(16px);transition:.22s ease;font-weight:800}.export-toast.show{opacity:1;transform:translateY(0)}.export-toast.ok{background:rgba(22,101,52,.96)}.export-toast.error{background:rgba(127,29,29,.96)}.export-toast.warning{background:rgba(146,64,14,.96)}.export-toast.info{background:rgba(30,64,175,.96)}
      body.theme-light .official-export-center{background:rgba(255,255,255,.58);border-color:rgba(15,23,42,.10)}body.theme-light .official-export-filters input,body.theme-light .official-export-filters select{background:rgba(255,255,255,.82);border-color:rgba(15,23,42,.12)}body.theme-light .export-card-btn{background:linear-gradient(135deg,rgba(255,255,255,.88),rgba(209,250,229,.48));border-color:rgba(15,23,42,.10)}
      @media(max-width:900px){.official-export-head{flex-direction:column}.official-export-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.official-export-filters .wide{grid-column:1/-1}.official-export-groups{grid-template-columns:1fr}.official-export-group>div{grid-template-columns:1fr}.export-card-btn{min-height:62px}}
    `;
    document.head.appendChild(style);
  }

  function patchLegacyEntrypoints() {
    window.ExportCenter = { open, close, download, setExportType, render, types: TYPES };
    if (!window.WaterFuel) window.WaterFuel = {};
    window.WaterFuel.openExportCenter = open;
    window.WaterFuel.closeExportCenter = close;
    window.WaterFuel.setExportType = setExportType;
    window.WaterFuel.executeExport = () => download(selectedType);
  }

  function boot() {
    injectStyles();
    patchLegacyEntrypoints();
  }

  window.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', boot);
  setTimeout(boot, 200);
  setTimeout(boot, 1000);
  boot();
})();
