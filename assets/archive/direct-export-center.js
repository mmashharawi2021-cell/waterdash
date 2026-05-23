(() => {
  const TYPES = {
    reportsAll: { title: 'تصدير التقارير بالكامل', group: 'التقارير', mode: 'allReports' },
    reportsDaily: { title: 'تقرير يومي', group: 'التقارير', mode: 'daily' },
    reportsWeekly: { title: 'تقرير أسبوعي', group: 'التقارير', mode: 'weekly' },
    reportsMonthly: { title: 'تقرير شهري', group: 'التقارير', mode: 'monthly' },
    reportsCustom: { title: 'تقرير مخصص', group: 'التقارير', mode: 'custom' },
    fuelSummary: { title: 'ملخص الوقود', group: 'الوقود', mode: 'custom' },
    incomingFuel: { title: 'الوقود الوارد', group: 'الوقود', mode: 'custom' },
    consumedFuel: { title: 'الوقود المستهلك', group: 'الوقود', mode: 'custom' },
    producedWater: { title: 'المياه المنتجة', group: 'المياه', mode: 'custom' },
    deliveredWater: { title: 'المياه المعبأة للجهات', group: 'المياه', mode: 'custom' },
    beneficiaries: { title: 'الجهات المستفيدة', group: 'الجهات', mode: 'custom' },
    beneficiaryOne: { title: 'جهة مستفيدة محددة', group: 'الجهات', mode: 'custom' }
  };

  const GROUPS = ['التقارير', 'الوقود', 'المياه', 'الجهات'];

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function monthNow() { return today().slice(0, 7); }
  function dateObj(date) { return new Date(`${date || today()}T12:00:00`); }
  function iso(d) { return d.toISOString().slice(0, 10); }

  function weekRange(baseDate) {
    const d = dateObj(baseDate);
    const day = d.getDay();
    const diffToSaturday = (day + 1) % 7;
    const start = new Date(d);
    start.setDate(d.getDate() - diffToSaturday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: iso(start), to: iso(end) };
  }

  function number(value) {
    if (window.ReportUtils?.number) return window.ReportUtils.number(value);
    const n = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function fmt(value, digits = 2) {
    const n = number(value);
    const r = +n.toFixed(digits);
    return Number.isInteger(r) ? r : r;
  }

  function fileName(value) {
    return clean(value || 'تصدير').replace(/[\\/:*?"<>|]/g, '-').slice(0, 90);
  }

  function clone(value) {
    try { return structuredClone(value); }
    catch { return JSON.parse(JSON.stringify(value || {})); }
  }

  function recalc(report) {
    try { return window.ReportUtils?.recalc ? window.ReportUtils.recalc(clone(report || {})) : clone(report || {}); }
    catch { return clone(report || {}); }
  }

  function dateText(value) { return window.ReportUtils?.displayDate ? window.ReportUtils.displayDate(value) : (value || ''); }
  function timeText(value) { return window.ReportUtils?.displayTimeArabic?.(value) || value || ''; }
  function firstPeriod(report) { return report?.generator?.periods?.[0] || {}; }

  async function fetchReports() {
    try {
      const snap = await firebase.firestore().collection('reports').orderBy('reportDate', 'desc').get();
      const reports = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      window.__WATER_REPORTS_CACHE__ = reports;
      return reports;
    } catch (error) {
      console.warn('Direct export reports fetch failed; using cache', error);
      return window.__WATER_REPORTS_CACHE__ || [];
    }
  }

  async function fetchFuel() {
    try {
      const snap = await firebase.firestore().collection('fuelEntries').orderBy('date', 'desc').get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.warn('Direct export fuel fetch failed; using cache', error);
      return window.WaterFuelRawEntries || [];
    }
  }

  function inRange(date, from, to) {
    if (!date) return false;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  function filtersForType(type) {
    const f = {
      day: document.getElementById('directExportDay')?.value || today(),
      week: document.getElementById('directExportWeek')?.value || today(),
      month: document.getElementById('directExportMonth')?.value || monthNow(),
      from: document.getElementById('directExportFrom')?.value || '',
      to: document.getElementById('directExportTo')?.value || today(),
      beneficiary: clean(document.getElementById('directExportBeneficiary')?.value || '')
    };
    const mode = TYPES[type]?.mode || 'custom';
    if (mode === 'allReports') return { from: '', to: '', beneficiary: f.beneficiary, label: 'كل التقارير' };
    if (mode === 'daily') return { from: f.day, to: f.day, beneficiary: f.beneficiary, label: f.day };
    if (mode === 'weekly') {
      const range = weekRange(f.week);
      return { ...range, beneficiary: f.beneficiary, label: `${range.from} إلى ${range.to}` };
    }
    if (mode === 'monthly') return { from: `${f.month}-01`, to: `${f.month}-31`, beneficiary: f.beneficiary, label: f.month };
    return { from: f.from, to: f.to, beneficiary: f.beneficiary, label: `${f.from || 'البداية'} إلى ${f.to || 'النهاية'}` };
  }

  function filterReports(reports, type) {
    const range = filtersForType(type);
    return (reports || []).map(recalc).filter(report => {
      if (TYPES[type]?.mode === 'allReports') return true;
      return inRange(report.reportDate, range.from, range.to);
    });
  }

  function filterFuel(entries, type) {
    const range = filtersForType(type);
    return (entries || []).filter(item => {
      if (TYPES[type]?.mode === 'allReports') return true;
      return inRange(item.date, range.from, range.to);
    });
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
        'الوقود المستهلك / لتر': report.fuel?.consumedDaily || '',
        'الرصيد السابق / لتر': report.fuel?.previousBalance || '',
        'الرصيد الحالي / لتر': report.fuel?.currentBalance || '',
        'إنتاج الغاطس كوب/ساعة': report.water?.submersibleRate || '',
        'بعد الفلترة كوب/ساعة': report.water?.filteredRate || '',
        'الإنتاج اليومي / كوب': report.water?.dailyProduction || '',
        'العادم / كوب': report.water?.rejectWater || '',
        'نسبة الفاقد %': report.water?.lossPercentage || '',
        'المياه المعبأة / كوب': report.water?.filledWater || '',
        'عدد السيارات': report.water?.carsCount || '',
        'PH بعد التحلية': report.tests?.phAfterDesalination || '',
        'PH مياه الغاطس': report.tests?.phWellWater || '',
        'TDS مياه محلاة': report.tests?.tdsDesalinated || '',
        'TDS البئر': report.tests?.tdsWell || '',
        'TDS العادم': report.tests?.tdsReject || '',
        'الكلور الحر': report.tests?.freeChlorine || '',
        'عدد التنبيهات': (report.warnings || []).length,
        'التنبيهات': (report.warnings || []).join(' | ')
      };
      for (let i = 0; i < maxBeneficiaries; i += 1) {
        const b = report.beneficiaries?.[i] || {};
        const idx = i + 1;
        row[`الجهة ${idx}`] = b.name || '';
        row[`كمية الجهة ${idx} / كوب`] = b.quantity || '';
        row[`سيارات الجهة ${idx}`] = b.cars || '';
      }
      return row;
    });
  }

  function beneficiaryRows(reports, type) {
    const filterName = filtersForType(type).beneficiary;
    return (reports || []).flatMap(report => (report.beneficiaries || [])
      .filter(b => type !== 'beneficiaryOne' || !filterName || String(b.name || '').includes(filterName))
      .map(b => ({
        'التاريخ': dateText(report.reportDate),
        'عنوان التقرير': report.title || '',
        'الجهة': b.name || '',
        'الكمية / كوب': b.quantity || '',
        'عدد السيارات': b.cars || '',
        'ملاحظات': b.notes || ''
      })));
  }

  function rowsFor(type, reports, fuelEntries) {
    if (type.startsWith('reports')) return reportRows(reports);
    if (type === 'incomingFuel') return fuelEntries.map(item => ({
      'التاريخ': item.date || '', 'اليوم': item.day || '', 'الساعة': item.time || '', 'المورد': item.supplier || item.donor || '', 'الكمية / لتر': item.quantityLiters ?? item.quantity ?? '', 'طريقة التعبئة': item.fillingMethod || '', 'المسلّم': item.deliveredBy || '', 'ملاحظات': item.notes || ''
    }));
    if (type === 'consumedFuel') return reports.map(report => ({
      'التاريخ': dateText(report.reportDate), 'عنوان التقرير': report.title || '', 'الوقود المستهلك / لتر': report.fuel?.consumedDaily || '', 'الرصيد السابق / لتر': report.fuel?.previousBalance || '', 'الرصيد الحالي / لتر': report.fuel?.currentBalance || '', 'الفاقد / لتر': report.fuel?.loss || ''
    }));
    if (type === 'fuelSummary') {
      const incoming = fuelEntries.reduce((sum, item) => sum + number(item.quantityLiters ?? item.quantity), 0);
      const consumed = reports.reduce((sum, report) => sum + number(report.fuel?.consumedDaily), 0);
      const municipal = reports.reduce((sum, report) => sum + number(report.fuel?.municipalSupplied), 0);
      return [{ 'إجمالي الوقود الوارد / لتر': fmt(incoming), 'إجمالي الوقود المستهلك / لتر': fmt(consumed), 'إجمالي مورد البلدية / لتر': fmt(municipal), 'الصافي التقديري / لتر': fmt(incoming + municipal - consumed) }];
    }
    if (type === 'producedWater') return reports.map(report => ({ 'التاريخ': dateText(report.reportDate), 'عنوان التقرير': report.title || '', 'الإنتاج اليومي / كوب': report.water?.dailyProduction || '', 'العادم / كوب': report.water?.rejectWater || '', 'نسبة الفاقد %': report.water?.lossPercentage || '' }));
    if (type === 'deliveredWater' || type === 'beneficiaries' || type === 'beneficiaryOne') return beneficiaryRows(reports, type);
    return reportRows(reports);
  }

  function autoWidth(ws, rows) {
    const headers = Object.keys(rows[0] || {});
    ws['!cols'] = headers.map(header => ({ wch: Math.min(Math.max(String(header).length, ...rows.map(row => String(row[header] ?? '').length), 8) + 2, 36) }));
    ws['!dir'] = 'rtl';
    if (headers.length) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length, 1), c: headers.length - 1 } }) };
  }

  function exportExcel(type, rows) {
    if (!window.XLSX) throw new Error('مكتبة Excel غير محملة.');
    const finalRows = rows.length ? rows : [{ 'ملاحظة': 'لا توجد بيانات للتصدير' }];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(finalRows, { skipHeader: false });
    autoWidth(ws, finalRows);
    XLSX.utils.book_append_sheet(wb, ws, 'التقارير');
    wb.Workbook = { Views: [{ RTL: true }] };
    const info = TYPES[type] || TYPES.reportsAll;
    const range = filtersForType(type).label;
    XLSX.writeFile(wb, `${fileName(info.title)} - ${fileName(range)}.xlsx`);
  }

  function exportPdf(type, rows) {
    const finalRows = rows.length ? rows : [{ 'ملاحظة': 'لا توجد بيانات للتصدير' }];
    const headers = Object.keys(finalRows[0]);
    const title = `${TYPES[type]?.title || 'تصدير'} - ${filtersForType(type).label}`;
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Tahoma,Arial;direction:rtl;padding:18px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #999;padding:6px;text-align:right;vertical-align:top}th{background:#eef6f2}</style></head><body><h1>${esc(title)}</h1><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${finalRows.map(row => `<tr>${headers.map(h => `<td>${esc(row[h])}</td>`).join('')}</tr>`).join('')}</tbody></table><script>print()<\/script></body></html>`;
    const win = window.open('', '_blank');
    if (!win) throw new Error('المتصفح منع نافذة PDF. اسمح بالنوافذ المنبثقة.');
    win.document.write(html); win.document.close();
  }

  function setLoading(type, loading) {
    document.querySelectorAll(`[data-direct-export="${type}"]`).forEach(btn => {
      btn.disabled = loading;
      if (loading) { btn.dataset.oldText = btn.textContent; btn.textContent = 'جاري التصدير...'; }
      else btn.textContent = btn.dataset.oldText || btn.textContent;
    });
  }

  async function download(type) {
    try {
      setLoading(type, true);
      const fileType = document.getElementById('directExportFileType')?.value || 'excel';
      const [allReports, allFuel] = await Promise.all([fetchReports(), fetchFuel()]);
      const reports = filterReports(allReports, type);
      const fuelEntries = filterFuel(allFuel, type);
      const rows = rowsFor(type, reports, fuelEntries);
      if (!rows.length) throw new Error('لا توجد بيانات ضمن الفترة المحددة لهذا التصدير.');
      if (fileType === 'pdf') exportPdf(type, rows); else exportExcel(type, rows);
    } catch (error) {
      console.error('Direct export failed', error);
      alert(`فشل التصدير: ${error.message || error}`);
    } finally {
      setLoading(type, false);
    }
  }

  function button(type) {
    const info = TYPES[type];
    return `<button type="button" class="direct-export-btn" data-direct-export="${type}" onclick="DirectExportCenter.download('${type}')"><span>⬇️</span><b>${esc(info.title)}</b><small>تحميل مباشر</small></button>`;
  }

  function render() {
    const section = document.getElementById('exportCenterSection');
    if (!section) return;
    section.style.display = 'block';
    section.className = 'export-center-section direct-export-center';
    section.innerHTML = `
      <div class="direct-export-head"><div><p class="eyebrow">مركز التصدير</p><h2>تصدير مباشر مصنّف</h2><small>اختر الفترة ثم اضغط أي نوع تصدير، وسيبدأ التحميل فورًا.</small></div><button class="btn" onclick="DirectExportCenter.close()">إغلاق</button></div>
      <div class="direct-export-filters">
        <label>نوع الملف<select id="directExportFileType"><option value="excel">Excel</option><option value="pdf">PDF</option></select></label>
        <label>اليوم<input id="directExportDay" type="date" value="${today()}"></label>
        <label>الأسبوع حسب تاريخ<input id="directExportWeek" type="date" value="${today()}"></label>
        <label>الشهر<input id="directExportMonth" type="month" value="${monthNow()}"></label>
        <label>من تاريخ<input id="directExportFrom" type="date"></label>
        <label>إلى تاريخ<input id="directExportTo" type="date" value="${today()}"></label>
        <label class="wide">اسم جهة محددة<input id="directExportBeneficiary" placeholder="اختياري لتصدير جهة محددة"></label>
      </div>
      <div class="direct-export-groups">
        ${GROUPS.map(group => `<article class="direct-export-group"><h3>${group}</h3><div>${Object.keys(TYPES).filter(type => TYPES[type].group === group).map(button).join('')}</div></article>`).join('')}
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

  function open() {
    ensureSection();
    render();
    setTimeout(() => document.getElementById('exportCenterSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function close() {
    const section = document.getElementById('exportCenterSection');
    if (section) section.style.display = 'none';
  }

  function injectStyle() {
    if (document.getElementById('directExportCenterStyle')) return;
    const style = document.createElement('style');
    style.id = 'directExportCenterStyle';
    style.textContent = `.direct-export-center{display:block;padding:18px;border-radius:24px}.direct-export-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}.direct-export-filters{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:16px}.direct-export-filters label{display:grid;gap:6px;font-weight:800;font-size:12px}.direct-export-filters input,.direct-export-filters select{min-height:42px;border-radius:13px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:inherit;padding:8px 10px;font-family:inherit}.direct-export-filters .wide{grid-column:span 2}.direct-export-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.direct-export-group{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.055);padding:14px}.direct-export-group h3{margin:0 0 12px}.direct-export-group>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.direct-export-btn{min-height:72px;border:1px solid rgba(52,211,153,.22);border-radius:16px;background:linear-gradient(135deg,rgba(15,23,42,.75),rgba(16,185,129,.14));color:inherit;font-family:inherit;text-align:right;padding:10px 12px;cursor:pointer;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:3px 8px}.direct-export-btn span{grid-row:span 2}.direct-export-btn b{font-size:14px}.direct-export-btn small{color:var(--muted,#9fb0c3)}.direct-export-btn:disabled{opacity:.62;cursor:wait}@media(max-width:900px){.direct-export-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.direct-export-filters .wide{grid-column:1/-1}.direct-export-groups{grid-template-columns:1fr}.direct-export-group>div{grid-template-columns:1fr}.direct-export-head{flex-direction:column}.direct-export-btn{min-height:62px}}`;
    document.head.appendChild(style);
  }

  function patchWaterFuel() {
    if (window.WaterFuel) {
      window.WaterFuel.openExportCenter = open;
      window.WaterFuel.closeExportCenter = close;
    }
  }

  function boot() { injectStyle(); patchWaterFuel(); }

  window.DirectExportCenter = { boot, open, close, download };
  window.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', boot);
  setTimeout(boot, 300);
  setTimeout(boot, 1200);
})();
