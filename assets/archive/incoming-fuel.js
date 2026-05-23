/*
  Incoming Fuel + Export Center
  Safe additive patch for the Water Operation Reports app.
  - Does not change old report schema.
  - Stores incoming fuel in a separate Firestore collection: fuelEntries.
  - Hides scattered old export buttons visually and exposes a single Export Center.
*/
(function () {
  const FUEL_COLLECTION = 'fuelEntries';
  const PATCH_FLAG = 'waterFuelPatchReady';
  const state = {
    entries: [],
    unsubscribeFuel: null,
    initialized: false,
    editingFuelId: null,
    selectedExportType: 'allReports'
  };

  const EXPORT_TYPES = {
    allReports: { section: 'reports', label: 'تصدير التقارير بالكامل', needsRange: true },
    dailyFull: { section: 'reports', label: 'تقرير يومي شامل', needsDay: true },
    monthlyFull: { section: 'reports', label: 'تقرير شهري شامل', needsMonth: true },
    monthlyShort: { section: 'reports', label: 'تقرير شهري مختصر', needsMonth: true },
    customReport: { section: 'reports', label: 'تقرير مخصص', needsRange: true },
    fuelSummary: { section: 'fuel', label: 'تصدير الوقود', needsRange: true },
    incomingFuel: { section: 'fuel', label: 'تصدير الوقود الوارد', needsRange: true },
    consumedFuel: { section: 'fuel', label: 'تصدير الوقود المستهلك', needsRange: true },
    producedWater: { section: 'water', label: 'تصدير المياه المنتجة', needsRange: true },
    deliveredWater: { section: 'water', label: 'تصدير المياه المعبأة للجهات', needsRange: true },
    beneficiaries: { section: 'beneficiaries', label: 'تصدير الجهات المستفيدة', needsRange: true },
    beneficiaryOne: { section: 'beneficiaries', label: 'تصدير جهة مستفيدة محددة', needsRange: true, needsBeneficiary: true }
  };

  const EXPORT_GROUPS = [
    ['reports', 'قسم التقارير'],
    ['fuel', 'قسم الوقود'],
    ['water', 'قسم المياه'],
    ['beneficiaries', 'قسم الجهات المستفيدة']
  ];

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function number(value) {
    if (window.ReportUtils?.number) return window.ReportUtils.number(value);
    const n = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function currentTime() {
    return new Date().toTimeString().slice(0, 5);
  }

  function arabicDay(dateValue = todayISO()) {
    try {
      return new Date(`${dateValue}T12:00:00`).toLocaleDateString('ar', { weekday: 'long' });
    } catch {
      return '';
    }
  }

  function db() {
    if (!window.firebase?.firestore) throw new Error('Firebase Firestore غير متاح.');
    return firebase.firestore();
  }

  function now() {
    return firebase.firestore.FieldValue.serverTimestamp();
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
    }, 2800);
  }

  function userName() {
    return window.WATER_APP_SETTINGS?.defaultUserName || 'صالح الدحنون';
  }

  function confirmAction(message) {
    return window.confirm(message);
  }

  function canUseFirebase() {
    return Boolean(window.firebase?.firestore && window.FirebaseService?.isConfigured);
  }

  function defaultFuelEntry() {
    const date = todayISO();
    return {
      day: arabicDay(date),
      date,
      time: currentTime(),
      supplier: '',
      quantityLiters: '',
      fillingMethod: 'فرد تعبئة',
      deliveredBy: '',
      notes: ''
    };
  }

  function normalizeFuelEntry(doc) {
    const data = doc.data ? doc.data() : doc;
    return {
      id: doc.id || data.id || '',
      day: data.day || arabicDay(data.date),
      date: data.date || '',
      time: data.time || '',
      supplier: data.supplier || data.donor || '',
      quantityLiters: data.quantityLiters ?? data.quantity ?? '',
      fillingMethod: data.fillingMethod || '',
      deliveredBy: data.deliveredBy || '',
      notes: data.notes || '',
      createdAt: data.createdAt || null,
      createdBy: data.createdBy || '',
      updatedAt: data.updatedAt || null,
      updatedBy: data.updatedBy || ''
    };
  }

  function startFuelListener() {
    if (state.unsubscribeFuel || !canUseFirebase()) return;
    try {
      state.unsubscribeFuel = db().collection(FUEL_COLLECTION).orderBy('date', 'desc').orderBy('time', 'desc').onSnapshot(snapshot => {
        state.entries = snapshot.docs.map(normalizeFuelEntry);
        patchDom();
      }, error => {
        console.warn('fuelEntries listener failed', error);
      });
    } catch (error) {
      console.warn('Could not start fuelEntries listener', error);
    }
  }

  function injectHeroButtons() {
    const heroActions = document.querySelector('.hero-actions');
    if (!heroActions || heroActions.dataset.fuelPatchInjected === '1') return;
    const fuelBtn = document.createElement('button');
    fuelBtn.className = 'btn primary big action-float fuel-entry-open-btn';
    fuelBtn.type = 'button';
    fuelBtn.textContent = '⛽ إضافة وقود وارد';
    fuelBtn.onclick = () => openFuelModal();

    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn action-float export-center-open-btn';
    exportBtn.type = 'button';
    exportBtn.textContent = '📦 مركز التصدير';
    exportBtn.onclick = () => openExportCenter();

    const oldAllExcel = [...heroActions.querySelectorAll('button')].find(btn => btn.textContent.includes('Excel شامل'));
    if (oldAllExcel) oldAllExcel.classList.add('old-export-hidden');

    heroActions.insertBefore(exportBtn, heroActions.children[3] || null);
    heroActions.insertBefore(fuelBtn, heroActions.children[1] || null);
    heroActions.dataset.fuelPatchInjected = '1';
  }

  function hideOldDetailExportButtons() {
    document.querySelectorAll('.report-actions-panel button').forEach(btn => {
      const text = btn.textContent || '';
      if (text.includes('تصدير PDF') || text.includes('تصدير Excel')) btn.classList.add('old-export-hidden');
    });
  }

  function injectFuelSection() {
    const stats = document.querySelector('.stats.dashboard-totals');
    if (!stats || document.getElementById('incomingFuelSection')) return;
    const section = document.createElement('section');
    section.id = 'incomingFuelSection';
    section.className = 'incoming-fuel-section';
    stats.insertAdjacentElement('afterend', section);
    renderFuelSection();
  }

  function renderFuelSection() {
    const section = document.getElementById('incomingFuelSection');
    if (!section) return;
    const total = state.entries.reduce((sum, item) => sum + number(item.quantityLiters), 0);
    const recent = state.entries.slice(0, 8);
    const rows = recent.map(item => `
      <tr>
        <td data-label="التاريخ"><strong>${esc(item.date)}</strong><br><small>${esc(item.day || '')} ${esc(item.time || '')}</small></td>
        <td data-label="المورد">${esc(item.supplier || '-')}</td>
        <td data-label="الكمية"><strong>${number(item.quantityLiters)}</strong> لتر</td>
        <td data-label="طريقة التعبئة">${esc(item.fillingMethod || '-')}</td>
        <td data-label="المسلّم">${esc(item.deliveredBy || '-')}</td>
        <td data-label="الإجراءات"><div class="fuel-actions"><button class="mini" type="button" onclick="WaterFuel.openFuelModal('${esc(item.id)}')">تعديل</button><button class="mini danger" type="button" onclick="WaterFuel.deleteFuelEntry('${esc(item.id)}')">حذف</button></div></td>
      </tr>`).join('');
    section.innerHTML = `
      <div class="fuel-head">
        <div><p class="eyebrow">الوقود الوارد</p><h2>آخر عمليات الوقود الوارد</h2><small>إجمالي الوقود الوارد المسجل: ${total} لتر</small></div>
        <button class="btn primary action-float" type="button" onclick="WaterFuel.openFuelModal()">➕ إضافة وقود وارد</button>
      </div>
      ${rows ? `<div class="fuel-table-wrap"><table class="fuel-table"><thead><tr><th>التاريخ</th><th>المورد</th><th>الكمية</th><th>طريقة التعبئة</th><th>المسلّم</th><th>الإجراءات</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="fuel-empty">لا توجد عمليات وقود وارد محفوظة حتى الآن.</div>'}
    `;
  }

  function fuelModalHtml(entry = defaultFuelEntry()) {
    return `
      <div id="fuelEntryModal" class="fuel-modal open" dir="rtl">
        <div class="fuel-modal-backdrop" onclick="WaterFuel.closeFuelModal()"></div>
        <div class="fuel-modal-panel">
          <button class="close" type="button" onclick="WaterFuel.closeFuelModal()">×</button>
          <div class="modal-title"><span>⛽</span><div><h2>${state.editingFuelId ? 'تعديل وقود وارد' : 'إضافة وقود وارد'}</h2><p>يسجل الوقود الوارد في مجموعة مستقلة ولا يغير بنية التقارير اليومية.</p></div></div>
          <form id="fuelEntryForm" class="fuel-form">
            <label>اليوم<input name="day" value="${esc(entry.day || '')}" required></label>
            <label>التاريخ<input name="date" type="date" value="${esc(entry.date || todayISO())}" required onchange="WaterFuel.syncFuelDay(this.value)"></label>
            <label>الساعة<input name="time" type="time" value="${esc(entry.time || currentTime())}" required></label>
            <label>الجهة المانحة / المورد<input name="supplier" value="${esc(entry.supplier || '')}" required placeholder="اسم الجهة أو المورد"></label>
            <label>كمية الوقود باللتر<input name="quantityLiters" type="number" min="0.01" step="0.01" value="${esc(entry.quantityLiters || '')}" required></label>
            <label>كيفية التعبئة<select name="fillingMethod" required>
              ${['فرد تعبئة', 'جالون جاهز', 'أخرى'].map(option => `<option value="${option}" ${entry.fillingMethod === option ? 'selected' : ''}>${option}</option>`).join('')}
            </select></label>
            <label class="wide">اسم الشخص الذي قام بتسليم الوقود<input name="deliveredBy" value="${esc(entry.deliveredBy || '')}" required></label>
            <label class="wide">ملاحظات اختيارية<textarea name="notes" placeholder="أي ملاحظات إضافية">${esc(entry.notes || '')}</textarea></label>
          </form>
          <div class="fuel-modal-actions">
            <button class="btn primary big action-float" type="button" onclick="WaterFuel.saveFuelEntry()">حفظ الوقود الوارد</button>
            <button class="btn" type="button" onclick="WaterFuel.closeFuelModal()">إلغاء</button>
          </div>
        </div>
      </div>`;
  }

  function openFuelModal(id = null) {
    state.editingFuelId = id || null;
    const old = document.getElementById('fuelEntryModal');
    if (old) old.remove();
    const entry = id ? state.entries.find(item => item.id === id) || defaultFuelEntry() : defaultFuelEntry();
    document.body.insertAdjacentHTML('beforeend', fuelModalHtml(entry));
  }

  function closeFuelModal() {
    document.getElementById('fuelEntryModal')?.remove();
    state.editingFuelId = null;
  }

  function syncFuelDay(dateValue) {
    const input = document.querySelector('#fuelEntryForm [name="day"]');
    if (input) input.value = arabicDay(dateValue);
  }

  function collectFuelForm() {
    const form = document.getElementById('fuelEntryForm');
    if (!form) throw new Error('نموذج الوقود غير مفتوح.');
    const data = new FormData(form);
    const entry = {
      day: String(data.get('day') || '').trim(),
      date: String(data.get('date') || '').trim(),
      time: String(data.get('time') || '').trim(),
      supplier: String(data.get('supplier') || '').trim(),
      quantityLiters: Number(data.get('quantityLiters')),
      fillingMethod: String(data.get('fillingMethod') || '').trim(),
      deliveredBy: String(data.get('deliveredBy') || '').trim(),
      notes: String(data.get('notes') || '').trim()
    };
    if (!entry.day || !entry.date || !entry.time || !entry.supplier || !entry.fillingMethod || !entry.deliveredBy) {
      throw new Error('يرجى تعبئة جميع الحقول الأساسية.');
    }
    if (!Number.isFinite(entry.quantityLiters) || entry.quantityLiters <= 0) {
      throw new Error('كمية الوقود يجب أن تكون رقمًا أكبر من صفر.');
    }
    return entry;
  }

  async function saveFuelEntry() {
    try {
      if (!canUseFirebase()) throw new Error('Firebase غير متاح أو غير مهيأ.');
      const entry = collectFuelForm();
      const payload = {
        ...entry,
        updatedAt: now(),
        updatedBy: userName()
      };
      if (state.editingFuelId) {
        await db().collection(FUEL_COLLECTION).doc(state.editingFuelId).set(payload, { merge: true });
        toast('تم تعديل سجل الوقود الوارد', 'ok');
      } else {
        await db().collection(FUEL_COLLECTION).add({
          ...payload,
          createdAt: now(),
          createdBy: userName()
        });
        toast('تم حفظ الوقود الوارد بنجاح', 'ok');
      }
      closeFuelModal();
    } catch (error) {
      toast(error?.message || 'تعذر حفظ الوقود الوارد', 'warn');
      console.error(error);
    }
  }

  async function deleteFuelEntry(id) {
    if (!id) return;
    const ok = confirmAction('هل تريد حذف سجل الوقود الوارد؟ لا يمكن التراجع عن الحذف.');
    if (!ok) return;
    try {
      await db().collection(FUEL_COLLECTION).doc(id).delete();
      toast('تم حذف سجل الوقود الوارد', 'ok');
    } catch (error) {
      toast('تعذر حذف سجل الوقود الوارد', 'warn');
      console.error(error);
    }
  }

  function injectExportCenter() {
    const fuelSection = document.getElementById('incomingFuelSection');
    if (!fuelSection || document.getElementById('exportCenterSection')) return;
    const section = document.createElement('section');
    section.id = 'exportCenterSection';
    section.className = 'export-center-section';
    section.style.display = 'none';
    fuelSection.insertAdjacentElement('afterend', section);
    renderExportCenter();
  }

  function openExportCenter() {
    const section = document.getElementById('exportCenterSection');
    if (!section) return;
    section.style.display = 'block';
    renderExportCenter();
    requestAnimationFrame(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function closeExportCenter() {
    const section = document.getElementById('exportCenterSection');
    if (section) section.style.display = 'none';
  }

  function setExportType(type) {
    state.selectedExportType = type;
    renderExportCenter();
  }

  function renderExportCenter() {
    const section = document.getElementById('exportCenterSection');
    if (!section) return;
    const type = EXPORT_TYPES[state.selectedExportType] || EXPORT_TYPES.allReports;
    const groupsHtml = EXPORT_GROUPS.map(([key, title]) => {
      const buttons = Object.entries(EXPORT_TYPES).filter(([, item]) => item.section === key).map(([id, item]) => `<button class="btn ${state.selectedExportType === id ? 'active primary' : ''}" type="button" onclick="WaterFuel.setExportType('${id}')">${esc(item.label)}</button>`).join('');
      return `<article class="export-group"><h3>${title}</h3>${buttons}</article>`;
    }).join('');
    section.innerHTML = `
      <div class="export-head"><div><p class="eyebrow">مركز التصدير</p><h2>صفحة التصدير الموحدة</h2><small>تم إخفاء أزرار التصدير القديمة المتفرقة، واستخدام هذه الصفحة كنقطة تحكم واحدة.</small></div><button class="btn" type="button" onclick="WaterFuel.closeExportCenter()">إغلاق</button></div>
      <div class="export-type-grid">${groupsHtml}</div>
      <form id="exportCenterForm" class="export-form">
        <label class="${type.needsRange ? '' : 'old-export-hidden'}">من تاريخ<input name="fromDate" type="date"></label>
        <label class="${type.needsRange ? '' : 'old-export-hidden'}">إلى تاريخ<input name="toDate" type="date" value="${todayISO()}"></label>
        <label class="${type.needsDay ? '' : 'old-export-hidden'}">اختيار يوم محدد<input name="specificDay" type="date" value="${todayISO()}"></label>
        <label class="${type.needsMonth ? '' : 'old-export-hidden'}">الشهر<input name="month" type="month" value="${todayISO().slice(0, 7)}"></label>
        <label class="${type.needsBeneficiary ? '' : 'old-export-hidden'}">الجهة المستفيدة<input name="beneficiary" placeholder="اكتب اسم الجهة كما هو في التقرير"></label>
        <label>نوع الملف<select name="fileType"><option value="excel">Excel</option><option value="pdf">PDF</option></select></label>
        <div class="wide export-actions"><button class="btn primary big action-float" type="button" onclick="WaterFuel.executeExport()">تنفيذ التصدير: ${esc(type.label)}</button></div>
      </form>`;
  }

  async function fetchReports() {
    const snapshot = await db().collection('reports').orderBy('reportDate', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async function fetchFuelEntries() {
    const snapshot = await db().collection(FUEL_COLLECTION).orderBy('date', 'desc').orderBy('time', 'desc').get();
    return snapshot.docs.map(normalizeFuelEntry);
  }

  function dateInRange(date, from, to) {
    if (!date) return false;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  function filterReports(reports, form, typeInfo) {
    if (typeInfo.needsDay) {
      const day = form.get('specificDay') || todayISO();
      return reports.filter(r => r.reportDate === day);
    }
    if (typeInfo.needsMonth) {
      const month = form.get('month') || todayISO().slice(0, 7);
      return reports.filter(r => String(r.reportDate || '').startsWith(month));
    }
    const from = String(form.get('fromDate') || '0000-01-01');
    const to = String(form.get('toDate') || '9999-12-31');
    return reports.filter(r => dateInRange(r.reportDate, from, to));
  }

  function rowsForType(type, reports, fuelEntries, form) {
    const beneficiaryName = String(form.get('beneficiary') || '').trim();
    switch (type) {
      case 'incomingFuel':
        return fuelEntries.map(item => ({ 'التاريخ': item.date, 'اليوم': item.day, 'الساعة': item.time, 'المورد': item.supplier, 'الكمية لتر': item.quantityLiters, 'طريقة التعبئة': item.fillingMethod, 'المسلّم': item.deliveredBy, 'ملاحظات': item.notes }));
      case 'consumedFuel':
        return reports.map(r => ({ 'التاريخ': r.reportDate, 'العنوان': r.title, 'الوقود المستهلك': r.fuel?.consumedDaily || 0, 'الرصيد السابق': r.fuel?.previousBalance || '', 'الرصيد الحالي': r.fuel?.currentBalance || '', 'الفاقد': r.fuel?.loss || '' }));
      case 'fuelSummary': {
        const incoming = fuelEntries.reduce((sum, item) => sum + number(item.quantityLiters), 0);
        const consumed = reports.reduce((sum, r) => sum + number(r.fuel?.consumedDaily), 0);
        const municipal = reports.reduce((sum, r) => sum + number(r.fuel?.municipalSupplied), 0);
        return [{ 'إجمالي الوقود الوارد': incoming, 'إجمالي الوقود المستهلك': consumed, 'إجمالي مورد البلدية من التقارير': municipal, 'صافي تقديري': incoming + municipal - consumed }];
      }
      case 'producedWater':
        return reports.map(r => ({ 'التاريخ': r.reportDate, 'العنوان': r.title, 'الإنتاج اليومي': r.water?.dailyProduction || 0, 'العادم': r.water?.rejectWater || 0, 'نسبة الفاقد': r.water?.lossPercentage || 0 }));
      case 'deliveredWater':
      case 'beneficiaries':
        return reports.flatMap(r => (r.beneficiaries || []).map(b => ({ 'التاريخ': r.reportDate, 'العنوان': r.title, 'الجهة': b.name, 'الكمية': b.quantity, 'السيارات': b.cars, 'ملاحظات': b.notes })));
      case 'beneficiaryOne':
        return reports.flatMap(r => (r.beneficiaries || [])
          .filter(b => !beneficiaryName || String(b.name || '').includes(beneficiaryName))
          .map(b => ({ 'التاريخ': r.reportDate, 'العنوان': r.title, 'الجهة': b.name, 'الكمية': b.quantity, 'السيارات': b.cars, 'ملاحظات': b.notes })));
      case 'monthlyShort': {
        const summary = window.ReportUtils?.summary ? window.ReportUtils.summary(reports) : {};
        return [{ 'عدد التقارير': reports.length, 'ساعات التشغيل': summary.runHours || 0, 'الوقود المستهلك': summary.fuelConsumed || 0, 'إنتاج المياه': summary.waterProduction || 0, 'المياه المعبأة': summary.filledWater || 0, 'عدد السيارات': summary.cars || 0, 'نسبة الفاقد': summary.lossPercentage || 0 }];
      }
      default:
        return reports.map(r => ({ 'التاريخ': r.reportDate, 'العنوان': r.title, 'المحطة': r.stationName, 'البئر': r.wellName, 'ساعات التشغيل': r.generator?.totalRunHours, 'الوقود المستهلك': r.fuel?.consumedDaily, 'الإنتاج': r.water?.dailyProduction, 'المعبأ': r.water?.filledWater, 'السيارات': r.water?.carsCount }));
    }
  }

  function exportExcel(filename, rows) {
    if (!window.XLSX) throw new Error('مكتبة Excel غير متاحة.');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'ملاحظة': 'لا توجد بيانات ضمن الفلاتر المحددة' }]);
    XLSX.utils.book_append_sheet(wb, ws, 'Export');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }

  function exportPdf(title, rows) {
    const htmlRows = rows.length ? rows.map(row => `<tr>${Object.values(row).map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('') : '<tr><td>لا توجد بيانات ضمن الفلاتر المحددة</td></tr>';
    const headers = rows.length ? Object.keys(rows[0]).map(key => `<th>${esc(key)}</th>`).join('') : '<th>ملاحظة</th>';
    const w = window.open('', '_blank');
    w.document.write(`<html lang="ar" dir="rtl"><head><title>${esc(title)}</title><style>body{font-family:Tahoma,Arial;direction:rtl;padding:28px;line-height:1.8}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:right}th{background:#f1f5f9}@media print{button{display:none}}</style></head><body><h1>${esc(title)}</h1><table><thead><tr>${headers}</tr></thead><tbody>${htmlRows}</tbody></table><script>print()<\/script></body></html>`);
    w.document.close();
  }

  async function executeExport() {
    try {
      if (!canUseFirebase()) throw new Error('Firebase غير متاح أو غير مهيأ.');
      const formEl = document.getElementById('exportCenterForm');
      const form = new FormData(formEl);
      const typeId = state.selectedExportType;
      const typeInfo = EXPORT_TYPES[typeId] || EXPORT_TYPES.allReports;
      const [allReports, allFuelEntries] = await Promise.all([fetchReports(), fetchFuelEntries()]);
      const reports = filterReports(allReports, form, typeInfo);
      const from = String(form.get('fromDate') || '0000-01-01');
      const to = String(form.get('toDate') || '9999-12-31');
      const fuelEntries = allFuelEntries.filter(item => dateInRange(item.date, from, to));
      const rows = rowsForType(typeId, reports, fuelEntries, form);
      const title = typeInfo.label;
      if (form.get('fileType') === 'pdf') exportPdf(title, rows);
      else exportExcel(title, rows);
      toast('تم تجهيز التصدير بنجاح', 'ok');
    } catch (error) {
      toast(error?.message || 'تعذر تنفيذ التصدير', 'warn');
      console.error(error);
    }
  }

  function patchDom() {
    startFuelListener();
    injectHeroButtons();
    injectFuelSection();
    injectExportCenter();
    hideOldDetailExportButtons();
    renderFuelSection();
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;
    const observer = new MutationObserver(() => {
      if (!window[PATCH_FLAG]) {
        window[PATCH_FLAG] = true;
        requestAnimationFrame(() => {
          patchDom();
          window[PATCH_FLAG] = false;
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('DOMContentLoaded', () => setTimeout(patchDom, 600));
    setTimeout(patchDom, 1200);
  }

  window.WaterFuel = {
    openFuelModal,
    closeFuelModal,
    syncFuelDay,
    saveFuelEntry,
    deleteFuelEntry,
    openExportCenter,
    closeExportCenter,
    setExportType,
    executeExport,
    patchDom
  };

  init();
})();
