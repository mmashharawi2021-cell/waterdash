/* Incoming fuel + export center v3
   Source-level fix: compact toolbar, duplicate-safe incoming fuel, cleanup duplicates.
*/
(function () {
  const COLLECTION = 'fuelEntries';
  const state = {
    entries: [],
    rawEntries: [],
    duplicates: [],
    unsubscribe: null,
    observerStarted: false,
    editingId: null,
    exportType: 'allReports',
    patching: false
  };

  const exportTypes = {
    allReports: { section: 'reports', label: 'تصدير التقارير بالكامل', range: true },
    dailyFull: { section: 'reports', label: 'تقرير يومي شامل', day: true },
    monthlyFull: { section: 'reports', label: 'تقرير شهري شامل', month: true },
    monthlyShort: { section: 'reports', label: 'تقرير شهري مختصر', month: true },
    customReport: { section: 'reports', label: 'تقرير مخصص', range: true },
    fuelSummary: { section: 'fuel', label: 'تصدير الوقود', range: true },
    incomingFuel: { section: 'fuel', label: 'تصدير الوقود الوارد', range: true },
    consumedFuel: { section: 'fuel', label: 'تصدير الوقود المستهلك', range: true },
    producedWater: { section: 'water', label: 'تصدير المياه المنتجة', range: true },
    deliveredWater: { section: 'water', label: 'تصدير المياه المعبأة للجهات', range: true },
    beneficiaries: { section: 'beneficiaries', label: 'تصدير الجهات المستفيدة', range: true },
    beneficiaryOne: { section: 'beneficiaries', label: 'تصدير جهة مستفيدة محددة', range: true, beneficiary: true }
  };

  const exportGroups = [
    ['reports', 'التقارير'],
    ['fuel', 'الوقود'],
    ['water', 'المياه'],
    ['beneficiaries', 'الجهات المستفيدة']
  ];

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }

  function num(value) {
    if (window.ReportUtils?.number) return window.ReportUtils.number(value);
    const n = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function fmt(value, digits = 2) {
    const n = num(value);
    const r = +n.toFixed(digits);
    return Number.isInteger(r) ? String(r) : String(r);
  }

  function today() { return new Date().toISOString().slice(0, 10); }
  function timeNow() { return new Date().toTimeString().slice(0, 5); }

  function dayName(date = today()) {
    try { return new Date(`${date}T12:00:00`).toLocaleDateString('ar', { weekday: 'long' }); }
    catch { return ''; }
  }

  function db() {
    if (!window.firebase?.firestore) throw new Error('Firebase Firestore غير متاح.');
    return firebase.firestore();
  }

  function serverTime() { return firebase.firestore.FieldValue.serverTimestamp(); }
  function userName() { return window.AuthUsers?.currentUser?.()?.fullName || window.WATER_APP_SETTINGS?.defaultUserName || 'صالح الدحنون'; }
  function configured() { return Boolean(window.firebase?.firestore && window.FirebaseService?.isConfigured); }

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

  function normalize(doc) {
    const data = doc.data ? doc.data() : doc;
    return {
      id: doc.id || data.id || '',
      day: data.day || dayName(data.date),
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

  function entryKey(entry) {
    return [
      clean(entry.date),
      clean(entry.time),
      clean(entry.supplier || entry.donor),
      fmt(entry.quantityLiters ?? entry.quantity),
      clean(entry.fillingMethod),
      clean(entry.deliveredBy)
    ].join('|');
  }

  function sortEntries(list) {
    return [...list].sort((a, b) => String(`${b.date || ''} ${b.time || ''}`).localeCompare(String(`${a.date || ''} ${a.time || ''}`)));
  }

  function splitUnique(list) {
    const seen = new Map();
    const unique = [];
    const duplicates = [];
    sortEntries(list).forEach(item => {
      const key = entryKey(item);
      if (seen.has(key)) duplicates.push(item);
      else {
        seen.set(key, item.id);
        unique.push(item);
      }
    });
    return { unique, duplicates };
  }

  function setEntries(list) {
    state.rawEntries = sortEntries(list || []);
    const split = splitUnique(state.rawEntries);
    state.entries = split.unique;
    state.duplicates = split.duplicates;
    window.WaterFuelRawEntries = state.rawEntries;
  }

  function startListener() {
    if (state.unsubscribe || !configured()) return;
    try {
      state.unsubscribe = db().collection(COLLECTION).orderBy('date', 'desc').onSnapshot(snapshot => {
        setEntries(snapshot.docs.map(normalize));
        patchDom();
      }, error => {
        console.warn('fuelEntries listener failed', error);
        setEntries([]);
        patchDom();
      });
    } catch (error) {
      console.warn('Could not start fuelEntries listener', error);
    }
  }

  function can(permission) {
    if (!window.AuthUsers?.currentUser) return true;
    const user = window.AuthUsers.currentUser();
    if (!user) return true;
    if (user.role === 'superAdmin' || user.roleLabel === 'مدير النظام') return true;
    return window.AuthUsers.hasPermission?.(permission) === true;
  }

  function actionButton(label, onclick, className = '') {
    return `<button class="btn toolbar-btn ${className}" type="button" onclick="${onclick}">${label}</button>`;
  }

  function ensureHeroButtons() {
    const heroActions = document.querySelector('.hero-actions');
    if (!heroActions) return;
    const signature = [
      can('createReports'), can('manageUsers'), can('manageSettings'), can('exportExcel'), window.AuthUsers?.currentUser?.()?.role || ''
    ].join('|');
    if (heroActions.dataset.compactToolbar === signature) return;

    const primary = can('createReports') ? actionButton('➕ إضافة تقرير جديد', 'App.openNew()', 'toolbar-main') : '';
    const fuel = actionButton('⛽ إضافة وقود وارد', 'WaterFuel.openFuelModal()', 'toolbar-fuel fuel-entry-open-btn');
    const moreItems = [
      can('createReports') ? actionButton('⧉ تكرار آخر تقرير', 'App.duplicateLastReport()', 'more-item') : '',
      actionButton('📈 تقارير تجميعية', 'App.openSummary()', 'more-item'),
      actionButton('📦 مركز التصدير', 'WaterFuel.openExportCenter()', 'more-item'),
      can('manageUsers') ? '<button class="btn toolbar-btn more-item" data-users-force-button="true" type="button" onclick="UsersUI.open()">👥 المستخدمون</button>' : '',
      can('manageSettings') ? actionButton('⚙️ الإعدادات', 'App.openSettings()', 'more-item') : '',
      actionButton('🚪 خروج', 'App.logout()', 'more-item toolbar-logout')
    ].filter(Boolean).join('');

    heroActions.className = 'hero-actions professional-actions compact-toolbar';
    heroActions.dataset.compactToolbar = signature;
    heroActions.innerHTML = `
      ${primary}
      ${fuel}
      <div class="more-menu-wrap">
        <button class="btn toolbar-btn toolbar-more" type="button" onclick="WaterFuel.toggleMoreMenu(event)">☰ المزيد</button>
        <div id="heroMoreMenu" class="more-menu">${moreItems}</div>
      </div>
    `;
  }

  function toggleMoreMenu(event) {
    event?.stopPropagation?.();
    document.getElementById('heroMoreMenu')?.classList.toggle('open');
  }

  document.addEventListener('click', e => {
    if (!e.target.closest('.more-menu-wrap')) document.getElementById('heroMoreMenu')?.classList.remove('open');
  });

  function hideOldExports() {
    document.querySelectorAll('.report-actions-panel button').forEach(btn => {
      const text = btn.textContent || '';
      if (text.includes('تصدير PDF') || text.includes('تصدير Excel')) btn.classList.add('old-export-hidden');
    });
  }

  function ensureFuelSection() {
    const stats = document.querySelector('.stats.dashboard-totals');
    if (!stats) return;
    let section = document.getElementById('incomingFuelSection');
    if (!section) {
      section = document.createElement('section');
      section.id = 'incomingFuelSection';
      section.className = 'incoming-fuel-section';
      stats.insertAdjacentElement('afterend', section);
    }
    renderFuelSection();
  }

  function renderFuelSection() {
    const section = document.getElementById('incomingFuelSection');
    if (!section) return;
    const total = state.entries.reduce((sum, item) => sum + num(item.quantityLiters), 0);
    const rows = state.entries.slice(0, 8).map(item => `
      <tr>
        <td data-label="التاريخ"><strong>${esc(item.date)}</strong><br><small>${esc(item.day)} ${esc(item.time)}</small></td>
        <td data-label="المورد">${esc(item.supplier || '-')}</td>
        <td data-label="الكمية"><strong>${fmt(item.quantityLiters)}</strong> لتر</td>
        <td data-label="طريقة التعبئة">${esc(item.fillingMethod || '-')}</td>
        <td data-label="المسلّم">${esc(item.deliveredBy || '-')}</td>
        <td data-label="الإجراءات"><div class="fuel-actions"><button class="mini" onclick="WaterFuel.openFuelModal('${esc(item.id)}')">تعديل</button><button class="mini danger" onclick="WaterFuel.deleteFuelEntry('${esc(item.id)}')">حذف</button></div></td>
      </tr>`).join('');

    section.innerHTML = `
      <div class="fuel-head">
        <div><p class="eyebrow">الوقود الوارد</p><h2>آخر عمليات الوقود الوارد</h2><small>إجمالي الوقود الوارد المسجل: ${fmt(total)} لتر${state.duplicates.length ? ` — تم إخفاء ${state.duplicates.length} سجل مكرر` : ''}</small></div>
        <div class="fuel-head-actions">
          <button class="btn primary fuel-fixed-add" onclick="WaterFuel.openFuelModal()">➕ إضافة وقود وارد</button>
          ${state.duplicates.length ? '<button class="btn fuel-cleanup-btn" onclick="WaterFuel.cleanupDuplicateFuelEntries()">تنظيف المكرر</button>' : ''}
        </div>
      </div>
      ${rows ? `<div class="fuel-table-wrap"><table class="fuel-table"><thead><tr><th>التاريخ</th><th>المورد</th><th>الكمية</th><th>طريقة التعبئة</th><th>المسلّم</th><th>الإجراءات</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="fuel-empty">لا توجد عمليات وقود وارد محفوظة حتى الآن.</div>'}
    `;
  }

  function defaultEntry() {
    const date = today();
    return { day: dayName(date), date, time: timeNow(), supplier: '', quantityLiters: '', fillingMethod: 'فرد تعبئة', deliveredBy: '', notes: '' };
  }

  function modalHtml(entry) {
    return `<div id="fuelEntryModal" class="fuel-modal open" dir="rtl">
      <div class="fuel-modal-backdrop" onclick="WaterFuel.closeFuelModal()"></div>
      <div class="fuel-modal-panel">
        <button class="close" onclick="WaterFuel.closeFuelModal()">×</button>
        <div class="modal-title"><span>⛽</span><div><h2>${state.editingId ? 'تعديل وقود وارد' : 'إضافة وقود وارد'}</h2><p>يحفظ هذا السجل في fuelEntries ولا يغير بنية التقرير اليومي.</p></div></div>
        <form id="fuelEntryForm" class="fuel-form">
          <label>اليوم<input name="day" required value="${esc(entry.day)}"></label>
          <label>التاريخ<input name="date" type="date" required value="${esc(entry.date)}" onchange="WaterFuel.syncFuelDay(this.value)"></label>
          <label>الساعة<input name="time" type="time" required value="${esc(entry.time)}"></label>
          <label>الجهة المانحة / المورد<input name="supplier" required value="${esc(entry.supplier)}"></label>
          <label>كمية الوقود باللتر<input name="quantityLiters" type="number" min="0.01" step="0.01" required value="${esc(entry.quantityLiters)}"></label>
          <label>كيفية التعبئة<select name="fillingMethod" required>${['فرد تعبئة', 'جالون جاهز', 'أخرى'].map(x => `<option value="${x}" ${entry.fillingMethod === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
          <label class="wide">اسم الشخص الذي قام بتسليم الوقود<input name="deliveredBy" required value="${esc(entry.deliveredBy)}"></label>
          <label class="wide">ملاحظات اختيارية<textarea name="notes">${esc(entry.notes)}</textarea></label>
        </form>
        <div class="fuel-modal-actions"><button class="btn primary big" onclick="WaterFuel.saveFuelEntry()">حفظ الوقود الوارد</button><button class="btn" onclick="WaterFuel.closeFuelModal()">إلغاء</button></div>
      </div>
    </div>`;
  }

  function openFuelModal(id = null) {
    state.editingId = id || null;
    document.getElementById('fuelEntryModal')?.remove();
    const entry = id ? state.rawEntries.find(x => x.id === id) || defaultEntry() : defaultEntry();
    document.body.insertAdjacentHTML('beforeend', modalHtml(entry));
  }

  function closeFuelModal() {
    document.getElementById('fuelEntryModal')?.remove();
    state.editingId = null;
  }

  function syncFuelDay(date) {
    const input = document.querySelector('#fuelEntryForm [name="day"]');
    if (input) input.value = dayName(date);
  }

  function collectFuel() {
    const form = document.getElementById('fuelEntryForm');
    const data = new FormData(form);
    const payload = {
      day: clean(data.get('day')),
      date: clean(data.get('date')),
      time: clean(data.get('time')),
      supplier: clean(data.get('supplier')),
      quantityLiters: Number(data.get('quantityLiters')),
      fillingMethod: clean(data.get('fillingMethod')),
      deliveredBy: clean(data.get('deliveredBy')),
      notes: clean(data.get('notes'))
    };
    if (!payload.day || !payload.date || !payload.time || !payload.supplier || !payload.fillingMethod || !payload.deliveredBy) throw new Error('يرجى تعبئة جميع الحقول الأساسية.');
    if (!Number.isFinite(payload.quantityLiters) || payload.quantityLiters <= 0) throw new Error('كمية الوقود يجب أن تكون رقمًا أكبر من صفر.');
    return payload;
  }

  function duplicateExists(payload) {
    const target = entryKey(payload);
    return state.rawEntries.some(item => item.id !== state.editingId && entryKey(item) === target);
  }

  async function saveFuelEntry() {
    const btn = document.querySelector('#fuelEntryModal .fuel-modal-actions .btn.primary');
    try {
      if (!configured()) throw new Error('Firebase غير متاح أو غير مهيأ.');
      const payload = { ...collectFuel(), updatedAt: serverTime(), updatedBy: userName() };
      if (duplicateExists(payload)) throw new Error('هذا الوقود الوارد مسجل مسبقًا بنفس البيانات. لم يتم حفظ نسخة مكررة.');
      if (btn) { btn.disabled = true; btn.textContent = 'جاري الحفظ...'; }
      if (state.editingId) {
        await db().collection(COLLECTION).doc(state.editingId).set(payload, { merge: true });
        toast('تم تعديل سجل الوقود الوارد', 'ok');
      } else {
        await db().collection(COLLECTION).add({ ...payload, createdAt: serverTime(), createdBy: userName() });
        toast('تم حفظ الوقود الوارد بنجاح', 'ok');
      }
      closeFuelModal();
    } catch (error) {
      toast(error?.message || 'تعذر حفظ الوقود الوارد', 'warn');
      console.error(error);
    } finally {
      if (btn?.isConnected) { btn.disabled = false; btn.textContent = 'حفظ الوقود الوارد'; }
    }
  }

  async function deleteFuelEntry(id) {
    if (!id || !confirm('هل تريد حذف سجل الوقود الوارد؟')) return;
    try {
      await db().collection(COLLECTION).doc(id).delete();
      toast('تم حذف سجل الوقود الوارد', 'ok');
    } catch (error) {
      toast('تعذر حذف سجل الوقود الوارد', 'warn');
      console.error(error);
    }
  }

  async function cleanupDuplicateFuelEntries() {
    if (!state.duplicates.length) return toast('لا توجد سجلات مكررة للتنظيف.', 'ok');
    if (!confirm(`سيتم حذف ${state.duplicates.length} سجل مكرر وترك نسخة واحدة. هل تريد المتابعة؟`)) return;
    try {
      const batch = db().batch();
      state.duplicates.forEach(item => batch.delete(db().collection(COLLECTION).doc(item.id)));
      await batch.commit();
      toast(`تم حذف ${state.duplicates.length} سجل مكرر.`, 'ok');
    } catch (error) {
      toast('تعذر تنظيف السجلات المكررة.', 'warn');
      console.error(error);
    }
  }

  function ensureExportCenter() {
    // ExportV4 يتولى إنشاء قسمه — لا نحتاج لإنشائه هنا
  }

  function openExportCenter() {
    if (window.ExportV4?.open) {
      window.ExportV4.open();
    } else {
      const check = setInterval(() => {
        if (window.ExportV4?.open) { clearInterval(check); window.ExportV4.open(); }
      }, 100);
      setTimeout(() => clearInterval(check), 3000);
    }
  }

  function closeExportCenter() {
    if (window.ExportV4?.close) window.ExportV4.close();
  }

  function setExportType(type) {
    state.exportType = type;
    if (window.ExportV4) {
      window.ExportV4.state.type = type;
      window.ExportV4.state.cat = window.ExportV4.types[type]?.cat || 'reports';
      window.ExportV4.render?.();
    }
  }

  function renderExportCenter() {
    // ExportV4 يتولى الرسم — لا نحتاج هذه الدالة
  }

  async function getReports() {
    const snap = await db().collection('reports').orderBy('reportDate', 'desc').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async function getFuelEntries() {
    const snap = await db().collection(COLLECTION).orderBy('date', 'desc').get();
    return splitUnique(sortEntries(snap.docs.map(normalize))).unique;
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
    if (typeId === 'incomingFuel') return fuelEntries.map(x => ({ 'التاريخ': x.date, 'اليوم': x.day, 'الساعة': x.time, 'المورد': x.supplier, 'الكمية لتر': x.quantityLiters, 'طريقة التعبئة': x.fillingMethod, 'المسلّم': x.deliveredBy, 'ملاحظات': x.notes }));
    if (typeId === 'consumedFuel') return reports.map(r => ({ 'التاريخ': r.reportDate, 'العنوان': r.title, 'الوقود المستهلك': r.fuel?.consumedDaily || 0, 'الرصيد السابق': r.fuel?.previousBalance || '', 'الرصيد الحالي': r.fuel?.currentBalance || '', 'الفاقد': r.fuel?.loss || '' }));
    if (typeId === 'fuelSummary') {
      const incoming = fuelEntries.reduce((s, x) => s + num(x.quantityLiters), 0);
      const consumed = reports.reduce((s, r) => s + num(r.fuel?.consumedDaily), 0);
      const municipal = reports.reduce((s, r) => s + num(r.fuel?.municipalSupplied), 0);
      return [{ 'إجمالي الوقود الوارد': incoming, 'إجمالي الوقود المستهلك': consumed, 'إجمالي مورد البلدية من التقارير': municipal, 'صافي تقديري': incoming + municipal - consumed }];
    }
    if (typeId === 'producedWater') return reports.map(r => ({ 'التاريخ': r.reportDate, 'العنوان': r.title, 'الإنتاج اليومي': r.water?.dailyProduction || 0, 'العادم': r.water?.rejectWater || 0, 'نسبة الفاقد': r.water?.lossPercentage || 0 }));
    if (['deliveredWater', 'beneficiaries', 'beneficiaryOne'].includes(typeId)) {
      return reports.flatMap(r => (r.beneficiaries || [])
        .filter(b => typeId !== 'beneficiaryOne' || !beneficiary || String(b.name || '').includes(beneficiary))
        .map(b => ({ 'التاريخ': r.reportDate, 'العنوان': r.title, 'الجهة': b.name, 'الكمية': b.quantity, 'السيارات': b.cars, 'ملاحظات': b.notes })));
    }
    if (typeId === 'monthlyShort') {
      const s = window.ReportUtils?.summary ? window.ReportUtils.summary(reports) : {};
      return [{ 'عدد التقارير': reports.length, 'ساعات التشغيل': s.runHours || 0, 'الوقود المستهلك': s.fuelConsumed || 0, 'إنتاج المياه': s.waterProduction || 0, 'المياه المعبأة': s.filledWater || 0, 'عدد السيارات': s.cars || 0, 'نسبة الفاقد': s.lossPercentage || 0 }];
    }
    return reports.map(r => ({ 'التاريخ': r.reportDate, 'العنوان': r.title, 'المحطة': r.stationName, 'البئر': r.wellName, 'ساعات التشغيل': r.generator?.totalRunHours, 'الوقود المستهلك': r.fuel?.consumedDaily, 'الإنتاج': r.water?.dailyProduction, 'المعبأ': r.water?.filledWater, 'السيارات': r.water?.carsCount }));
  }

  function exportExcel(name, rows) {
    if (!window.XLSX) throw new Error('مكتبة Excel غير متاحة.');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'ملاحظة': 'لا توجد بيانات ضمن الفلاتر المحددة' }]), 'Export');
    XLSX.writeFile(wb, `${name}.xlsx`);
  }

  function exportPdf(name, rows) {
    const headers = rows.length ? Object.keys(rows[0]).map(h => `<th>${esc(h)}</th>`).join('') : '<th>ملاحظة</th>';
    const body = rows.length ? rows.map(r => `<tr>${Object.values(r).map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('') : '<tr><td>لا توجد بيانات ضمن الفلاتر المحددة</td></tr>';
    const w = window.open('', '_blank');
    w.document.write(`<html lang="ar" dir="rtl"><head><title>${esc(name)}</title><style>body{font-family:Tahoma,Arial;direction:rtl;padding:28px;line-height:1.8}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:right}th{background:#f1f5f9}</style></head><body><h1>${esc(name)}</h1><table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table><script>print()<\/script></body></html>`);
    w.document.close();
  }

  async function executeExport() {
    // يُوجَّه إلى ExportV4 — مركز التصدير الموحد
    openExportCenter();
  }

  function patchDom() {
    if (state.patching) return;
    state.patching = true;
    requestAnimationFrame(() => {
      startListener();
      ensureHeroButtons();
      hideOldExports();
      ensureFuelSection();
      ensureExportCenter();
      state.patching = false;
    });
  }

  function init() {
    if (state.observerStarted) return;
    state.observerStarted = true;
    new MutationObserver(patchDom).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('DOMContentLoaded', () => setTimeout(patchDom, 500));
    setTimeout(patchDom, 1200);
  }

  window.WaterFuel = { openFuelModal, closeFuelModal, syncFuelDay, saveFuelEntry, deleteFuelEntry, cleanupDuplicateFuelEntries, openExportCenter, closeExportCenter, setExportType, executeExport, toggleMoreMenu, patchDom };
  init();
})();
