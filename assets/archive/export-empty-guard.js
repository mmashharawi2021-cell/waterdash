(() => {
  const BUILD_ID = window.WATER_APP_BUILD || '20260518-production-sync-1';
  const COLLECTION = 'fuelEntries';

  const exportTypes = {
    allReports: { label: 'تصدير التقارير بالكامل', range: true },
    dailyFull: { label: 'تقرير يومي شامل', day: true },
    monthlyFull: { label: 'تقرير شهري شامل', month: true },
    monthlyShort: { label: 'تقرير شهري مختصر', month: true },
    customReport: { label: 'تقرير مخصص', range: true },
    fuelSummary: { label: 'تصدير الوقود', range: true },
    incomingFuel: { label: 'تصدير الوقود الوارد', range: true },
    consumedFuel: { label: 'تصدير الوقود المستهلك', range: true },
    producedWater: { label: 'تصدير المياه المنتجة', range: true },
    deliveredWater: { label: 'تصدير المياه المعبأة للجهات', range: true },
    beneficiaries: { label: 'تصدير الجهات المستفيدة', range: true },
    beneficiaryOne: { label: 'تصدير جهة مستفيدة محددة', range: true, beneficiary: true }
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function num(value) {
    if (window.ReportUtils?.number) return window.ReportUtils.number(value);
    const n = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function db() {
    if (!window.firebase?.firestore) throw new Error('Firebase Firestore غير متاح.');
    return firebase.firestore();
  }

  function configured() {
    return Boolean(window.firebase?.firestore && window.FirebaseService?.isConfigured);
  }

  function toast(message, type = 'ok') {
    const el = document.createElement('div');
    el.className = `fuel-toast ${type}`;
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 220);
    }, 3200);
  }

  function normalizeFuelDoc(doc) {
    const data = doc.data ? doc.data() : doc;
    return {
      id: doc.id || data.id || '',
      day: data.day || '',
      date: data.date || '',
      time: data.time || '',
      supplier: data.supplier || data.donor || '',
      quantityLiters: data.quantityLiters ?? data.quantity ?? '',
      fillingMethod: data.fillingMethod || '',
      deliveredBy: data.deliveredBy || '',
      notes: data.notes || ''
    };
  }

  function entryKey(entry) {
    return [
      clean(entry.date),
      clean(entry.time),
      clean(entry.supplier || entry.donor),
      String(num(entry.quantityLiters ?? entry.quantity)),
      clean(entry.fillingMethod),
      clean(entry.deliveredBy)
    ].join('|');
  }

  function uniqueFuelEntries(entries) {
    const seen = new Set();
    return [...entries]
      .sort((a, b) => String(`${b.date || ''} ${b.time || ''}`).localeCompare(String(`${a.date || ''} ${a.time || ''}`)))
      .filter(entry => {
        const key = entryKey(entry);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  async function getReports() {
    const snap = await db().collection('reports').orderBy('reportDate', 'desc').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async function getFuelEntries() {
    const snap = await db().collection(COLLECTION).orderBy('date', 'desc').get();
    return uniqueFuelEntries(snap.docs.map(normalizeFuelDoc));
  }

  function activeExportTypeId() {
    const activeText = clean(document.querySelector('#exportCenterSection .export-type-grid .btn.active')?.textContent || '');
    const executeText = clean(document.querySelector('#exportCenterForm .export-actions .btn.primary')?.textContent || '');
    const text = activeText || executeText;
    const matched = Object.entries(exportTypes).find(([, type]) => text.includes(type.label));
    return matched?.[0] || 'allReports';
  }

  function inRange(date, from, to) {
    if (!date) return false;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  function filterReports(reports, form, type) {
    if (type.day) return reports.filter(r => r.reportDate === String(form.get('specificDay') || today()));
    if (type.month) return reports.filter(r => String(r.reportDate || '').startsWith(String(form.get('month') || today().slice(0, 7))));
    const from = String(form.get('fromDate') || '0000-01-01');
    const to = String(form.get('toDate') || '9999-12-31');
    return reports.filter(r => inRange(r.reportDate, from, to));
  }

  function rowsFor(typeId, reports, fuelEntries, form) {
    const beneficiary = String(form.get('beneficiary') || '').trim();

    if (typeId === 'incomingFuel') {
      return fuelEntries.map(x => ({
        'التاريخ': x.date,
        'اليوم': x.day,
        'الساعة': x.time,
        'المورد': x.supplier,
        'الكمية لتر': x.quantityLiters,
        'طريقة التعبئة': x.fillingMethod,
        'المسلّم': x.deliveredBy,
        'ملاحظات': x.notes
      }));
    }

    if (typeId === 'consumedFuel') {
      return reports.map(r => ({
        'التاريخ': r.reportDate,
        'العنوان': r.title,
        'الوقود المستهلك': r.fuel?.consumedDaily || 0,
        'الرصيد السابق': r.fuel?.previousBalance || '',
        'الرصيد الحالي': r.fuel?.currentBalance || '',
        'الفاقد': r.fuel?.loss || ''
      }));
    }

    if (typeId === 'fuelSummary') {
      if (!reports.length && !fuelEntries.length) return [];
      const incoming = fuelEntries.reduce((sum, x) => sum + num(x.quantityLiters), 0);
      const consumed = reports.reduce((sum, r) => sum + num(r.fuel?.consumedDaily), 0);
      const municipal = reports.reduce((sum, r) => sum + num(r.fuel?.municipalSupplied), 0);
      return [{
        'إجمالي الوقود الوارد': incoming,
        'إجمالي الوقود المستهلك': consumed,
        'إجمالي مورد البلدية من التقارير': municipal,
        'صافي تقديري': incoming + municipal - consumed
      }];
    }

    if (typeId === 'producedWater') {
      return reports.map(r => ({
        'التاريخ': r.reportDate,
        'العنوان': r.title,
        'الإنتاج اليومي': r.water?.dailyProduction || 0,
        'العادم': r.water?.rejectWater || 0,
        'نسبة الفاقد': r.water?.lossPercentage || 0
      }));
    }

    if (['deliveredWater', 'beneficiaries', 'beneficiaryOne'].includes(typeId)) {
      return reports.flatMap(r => (r.beneficiaries || [])
        .filter(b => typeId !== 'beneficiaryOne' || !beneficiary || String(b.name || '').includes(beneficiary))
        .map(b => ({
          'التاريخ': r.reportDate,
          'العنوان': r.title,
          'الجهة': b.name,
          'الكمية': b.quantity,
          'السيارات': b.cars,
          'ملاحظات': b.notes
        })));
    }

    if (typeId === 'monthlyShort') {
      if (!reports.length) return [];
      const summary = window.ReportUtils?.summary ? window.ReportUtils.summary(reports) : {};
      return [{
        'عدد التقارير': reports.length,
        'ساعات التشغيل': summary.runHours || 0,
        'الوقود المستهلك': summary.fuelConsumed || 0,
        'إنتاج المياه': summary.waterProduction || 0,
        'المياه المعبأة': summary.filledWater || 0,
        'عدد السيارات': summary.cars || 0,
        'نسبة الفاقد': summary.lossPercentage || 0
      }];
    }

    return reports.map(r => ({
      'التاريخ': r.reportDate,
      'العنوان': r.title,
      'المحطة': r.stationName,
      'البئر': r.wellName,
      'ساعات التشغيل': r.generator?.totalRunHours,
      'الوقود المستهلك': r.fuel?.consumedDaily,
      'الإنتاج': r.water?.dailyProduction,
      'المعبأ': r.water?.filledWater,
      'السيارات': r.water?.carsCount
    }));
  }

  function exportExcel(name, rows) {
    if (!window.XLSX) throw new Error('مكتبة Excel غير متاحة.');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Export');
    XLSX.writeFile(wb, `${name}.xlsx`);
  }

  function exportPdf(name, rows) {
    const headers = Object.keys(rows[0]).map(h => `<th>${esc(h)}</th>`).join('');
    const body = rows.map(row => `<tr>${Object.values(row).map(value => `<td>${esc(value)}</td>`).join('')}</tr>`).join('');
    const printWindow = window.open('', '_blank');
    if (!printWindow) throw new Error('المتصفح منع فتح نافذة التصدير. اسمح بالنوافذ المنبثقة لهذا الموقع.');
    printWindow.document.write(`<html lang="ar" dir="rtl"><head><title>${esc(name)}</title><style>body{font-family:Tahoma,Arial;direction:rtl;padding:28px;line-height:1.8}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:right}th{background:#f1f5f9}</style></head><body><h1>${esc(name)}</h1><table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table><script>print()<\/script></body></html>`);
    printWindow.document.close();
  }

  async function executeExportSafe() {
    try {
      if (!configured()) throw new Error('Firebase غير متاح أو غير مهيأ.');
      const formEl = document.getElementById('exportCenterForm');
      if (!formEl) throw new Error('نموذج التصدير غير مفتوح.');

      const form = new FormData(formEl);
      const typeId = activeExportTypeId();
      const type = exportTypes[typeId] || exportTypes.allReports;
      const [allReports, allFuel] = await Promise.all([getReports(), getFuelEntries()]);
      const reports = filterReports(allReports, form, type);
      const from = String(form.get('fromDate') || '0000-01-01');
      const to = String(form.get('toDate') || '9999-12-31');
      const fuelEntries = allFuel.filter(entry => inRange(entry.date, from, to));
      const rows = rowsFor(typeId, reports, fuelEntries, form);

      if (!rows.length) {
        toast('لا توجد بيانات ضمن الفلاتر المحددة. لم يتم إنشاء ملف فارغ.', 'warn');
        return;
      }

      const title = type.label;
      if (form.get('fileType') === 'pdf') exportPdf(title, rows);
      else exportExcel(title, rows);
      toast(`تم إنشاء ${rows.length} صف/سجل للتصدير بنجاح`, 'ok');
    } catch (error) {
      toast(error?.message || 'تعذر تنفيذ التصدير', 'warn');
      console.error(error);
    }
  }

  function patchWaterFuelExport() {
    if (!window.WaterFuel || window.WaterFuel.__emptyExportGuard === BUILD_ID) return;
    window.WaterFuel.__originalExecuteExport = window.WaterFuel.executeExport;
    window.WaterFuel.executeExport = executeExportSafe;
    window.WaterFuel.__emptyExportGuard = BUILD_ID;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchWaterFuelExport);
  } else {
    patchWaterFuelExport();
  }

  const interval = setInterval(() => {
    patchWaterFuelExport();
    if (window.WaterFuel?.__emptyExportGuard === BUILD_ID) clearInterval(interval);
  }, 300);
  setTimeout(() => clearInterval(interval), 6000);
})();
