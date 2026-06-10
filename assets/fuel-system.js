/* --- Auto-Generated Module: fuel-system.js --- */

/* ==========================================
   FILE: incoming-fuel-v2.js
   ========================================== */
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
      type: data.type || 'incoming',
      day: data.day || dayName(data.date),
      date: data.date || '',
      time: data.time || '',
      supplier: data.supplier || data.donor || '',
      source: data.source || 'municipality',
      quantityLiters: data.quantityLiters ?? data.quantity ?? '',
      fillingMethod: data.fillingMethod || '',
      deliveredBy: data.deliveredBy || '',
      notes: data.notes || '',
      createdAt: data.createdAt || null,
      createdBy: data.createdBy || '',
      updatedAt: data.updatedAt || null,
      updatedBy: data.updatedBy || '',
      consumedFor: data.consumedFor || '',
      receivedBy: data.receivedBy || ''
    };
  }

  function entryKey(entry) {
    return [
      clean(entry.type || 'incoming'),
      clean(entry.date),
      clean(entry.time),
      clean(entry.supplier || entry.donor || entry.consumedFor),
      fmt(entry.quantityLiters ?? entry.quantity),
      clean(entry.fillingMethod),
      clean(entry.deliveredBy || entry.receivedBy)
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
    if (window.App?.render) {
      window.App.render();
    }
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
    let section = document.getElementById('incomingFuelSection');
    if (!section) {
      const stats = document.querySelector('.stats.dashboard-totals');
      const charts = document.querySelector('.dashboard-charts-grid');
      const mainContent = document.querySelector('.dashboard-content') || document.querySelector('.app-shell');
      if (!stats && !charts && !mainContent) return;

      section = document.createElement('section');
      section.id = 'incomingFuelSection';
      section.className = 'incoming-fuel-section';
      section.style.marginTop = '32px';

      if (stats) {
        stats.insertAdjacentElement('afterend', section);
      } else if (charts) {
        charts.insertAdjacentElement('afterend', section);
      } else if (mainContent) {
        mainContent.appendChild(section);
      }
    }
    
    // Toggle visibility based on state view
    const appState = window.App?.state;
    if (appState && appState.view !== 'home') {
      section.style.display = 'none';
    } else {
      section.style.display = 'block';
      if (typeof renderStableFuelSection === 'function') {
        renderStableFuelSection();
      } else {
        renderFuelSection();
      }
    }
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
    return { type: 'incoming', day: dayName(date), date, time: timeNow(), supplier: '', source: 'municipality', quantityLiters: '', fillingMethod: 'فرد تعبئة', deliveredBy: '', notes: '', consumedFor: 'المولد الكهربائي', receivedBy: '' };
  }

  function toggleFuelFields(type) {
    const inc = document.getElementById('incomingFields');
    const cons = document.getElementById('consumedFields');
    const qtyLabel = document.getElementById('quantityLabel');
    const qtyInput = document.querySelector('#fuelEntryForm [name="quantityLiters"]');
    const qtyConsumedInput = document.querySelector('#fuelEntryForm [name="quantityConsumed"]');
    
    if (type === 'consumed') {
      if (inc) inc.style.display = 'none';
      if (cons) cons.style.display = 'grid';
      if (qtyLabel) qtyLabel.style.display = 'none';
      if (qtyInput) qtyInput.required = false;
      if (qtyConsumedInput) qtyConsumedInput.required = true;
    } else {
      if (inc) inc.style.display = 'contents';
      if (cons) cons.style.display = 'none';
      if (qtyLabel) qtyLabel.style.display = 'block';
      if (qtyInput) qtyInput.required = true;
      if (qtyConsumedInput) qtyConsumedInput.required = false;
    }
  }

  function modalHtml(entry) {
    const type = entry.type || 'incoming';
    return `<div id="fuelEntryModal" class="fuel-modal open" dir="rtl">
      <div class="fuel-modal-backdrop" onclick="WaterFuel.closeFuelModal()"></div>
      <div class="fuel-modal-panel">
        <button class="close" onclick="WaterFuel.closeFuelModal()">×</button>
        <div class="modal-title"><span>⛽</span><div><h2>${state.editingId ? 'تعديل حركة السولار' : 'تسجيل حركة سولار'}</h2><p>يتم حفظ هذا السجل بشكل مستقل عن التقارير اليومية.</p></div></div>
        <form id="fuelEntryForm" class="fuel-form">
          <label class="wide">نوع العملية
            <select name="type" required onchange="WaterFuel.toggleFuelFields(this.value)">
              <option value="incoming" ${type === 'incoming' ? 'selected' : ''}>وارد (توريد سولار للمحطة)</option>
              <option value="consumed" ${type === 'consumed' ? 'selected' : ''}>مستهلك (استهلاك المولد)</option>
            </select>
          </label>
          <label>اليوم<input name="day" required value="${esc(entry.day)}"></label>
          <label>التاريخ<input name="date" type="date" required value="${esc(entry.date)}" onchange="WaterFuel.syncFuelDay(this.value)"></label>
          <label>الساعة<input name="time" type="time" required value="${esc(entry.time)}"></label>
          
          <div id="incomingFields" style="display: ${type === 'consumed' ? 'none' : 'contents'};">
            <label>الجهة المانحة / المورد<input name="supplier" value="${esc(entry.supplier)}"></label>
            <label>مصدر التوريد
              <select name="source">
                <option value="municipality" ${entry.source === 'municipality' ? 'selected' : ''}>مورد من البلدية</option>
                <option value="purchased" ${entry.source === 'purchased' ? 'selected' : ''}>شراء مباشر</option>
                <option value="other" ${entry.source === 'other' ? 'selected' : ''}>أخرى</option>
              </select>
            </label>
            <label>كيفية التعبئة<select name="fillingMethod">${['فرد تعبئة', 'جالون جاهز', 'أخرى'].map(x => `<option value="${x}" ${entry.fillingMethod === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
            <label class="wide">اسم الشخص الذي قام بتسليم الوقود<input name="deliveredBy" value="${esc(entry.deliveredBy)}"></label>
          </div>

          <div id="consumedFields" style="display: ${type === 'consumed' ? 'grid' : 'none'}; grid-column: 1 / -1; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; width: 100%;">
            <label>المستهلك باللتر<input name="quantityConsumed" type="number" min="0.01" step="0.01" value="${esc(type === 'consumed' ? entry.quantityLiters : '')}"></label>
            <label>جهة الاستهلاك / الغرض<input name="consumedFor" value="${esc(entry.consumedFor || 'المولد الكهربائي')}"></label>
            <label>المستلم / المشغل المسؤول<input name="receivedBy" value="${esc(entry.receivedBy || '')}"></label>
          </div>

          <label id="quantityLabel" style="display: ${type === 'consumed' ? 'none' : 'block'};">كمية الوقود باللتر<input name="quantityLiters" type="number" min="0.01" step="0.01" value="${esc(type === 'consumed' ? '' : entry.quantityLiters)}"></label>
          <label class="wide">ملاحظات اختيارية<textarea name="notes">${esc(entry.notes)}</textarea></label>
        </form>
        <div class="fuel-modal-actions"><button class="btn primary big" onclick="WaterFuel.saveFuelEntry()">حفظ سجل الوقود</button><button class="btn" onclick="WaterFuel.closeFuelModal()">إلغاء</button></div>
      </div>
    </div>`;
  }

  function openFuelModal(id = null) {
    state.editingId = id || null;
    document.getElementById('fuelEntryModal')?.remove();
    const entry = id ? state.rawEntries.find(x => x.id === id) || defaultEntry() : defaultEntry();
    document.body.insertAdjacentHTML('beforeend', modalHtml(entry));
    toggleFuelFields(entry.type || 'incoming');
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
    const type = data.get('type') || 'incoming';
    
    let payload = {
      type: type,
      day: clean(data.get('day')),
      date: clean(data.get('date')),
      time: clean(data.get('time')),
      notes: clean(data.get('notes'))
    };
    
    if (type === 'consumed') {
      payload.quantityLiters = Number(data.get('quantityConsumed'));
      payload.consumedFor = clean(data.get('consumedFor')) || 'المولد الكهربائي';
      payload.receivedBy = clean(data.get('receivedBy'));
      
      payload.supplier = '';
      payload.source = '';
      payload.fillingMethod = '';
      payload.deliveredBy = '';
      
      if (!payload.day || !payload.date || !payload.time || !payload.receivedBy) {
        throw new Error('يرجى تعبئة جميع الحقول الأساسية للاستهلاك.');
      }
    } else {
      payload.quantityLiters = Number(data.get('quantityLiters'));
      payload.supplier = clean(data.get('supplier'));
      payload.source = clean(data.get('source')) || 'municipality';
      payload.fillingMethod = clean(data.get('fillingMethod'));
      payload.deliveredBy = clean(data.get('deliveredBy'));
      
      payload.consumedFor = '';
      payload.receivedBy = '';
      
      if (!payload.day || !payload.date || !payload.time || !payload.supplier || !payload.fillingMethod || !payload.deliveredBy) {
        throw new Error('يرجى تعبئة جميع الحقول الأساسية للتوريد.');
      }
    }
    
    if (!Number.isFinite(payload.quantityLiters) || payload.quantityLiters <= 0) {
      throw new Error('كمية الوقود يجب أن تكون رقمًا أكبر من صفر.');
    }
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

  window.WaterFuel = { openFuelModal, closeFuelModal, syncFuelDay, collectFuel, saveFuelEntry, deleteFuelEntry, cleanupDuplicateFuelEntries, openExportCenter, closeExportCenter, setExportType, executeExport, toggleMoreMenu, patchDom, toggleFuelFields };
  init();
})();


/* ==========================================
   FILE: fuel-entry-dedupe-fix.js
   ========================================== */
(() => {
  // Compatibility file: referenced by index.html.
  // Duplicate prevention and cleanup are handled by incoming-fuel-v2.js.
  window.FuelEntryDedupeFixLoaded = true;
})();


/* ==========================================
   FILE: fuel-entry-source-fix.js
   ========================================== */
(() => {
  const COLLECTION = 'fuelEntries';
  let saving = false;
  let lastRenderSignature = '';

  function db() {
    if (!window.firebase?.firestore) throw new Error('Firebase Firestore غير متاح.');
    return firebase.firestore();
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function num(value) {
    const n = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function fmt(n) { return Number.isInteger(n) ? n : +n.toFixed(2); }

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function q(value) {
    return num(value).toFixed(2);
  }

  function keyOf(item) {
    return [
      clean(item.type || 'incoming'),
      clean(item.date),
      clean(item.time),
      clean(item.supplier || item.donor || item.consumedFor),
      q(item.quantityLiters ?? item.quantity),
      clean(item.fillingMethod),
      clean(item.deliveredBy || item.receivedBy)
    ].join('|');
  }

  function normalize(doc) {
    const data = doc.data ? doc.data() : doc;
    return {
      id: doc.id || data.id || '',
      type: data.type || 'incoming',
      day: data.day || '',
      date: data.date || '',
      time: data.time || '',
      supplier: data.supplier || data.donor || '',
      source: data.source || 'municipality',
      quantityLiters: data.quantityLiters ?? data.quantity ?? '',
      fillingMethod: data.fillingMethod || '',
      deliveredBy: data.deliveredBy || '',
      notes: data.notes || '',
      createdAt: data.createdAt || null,
      consumedFor: data.consumedFor || '',
      receivedBy: data.receivedBy || ''
    };
  }

  function uniqueEntries(entries) {
    const map = new Map();
    const duplicates = [];
    (entries || []).forEach(entry => {
      const key = keyOf(entry);
      if (!map.has(key)) map.set(key, entry);
      else duplicates.push(entry);
    });
    return { unique: [...map.values()], duplicates };
  }

  function sortEntries(entries) {
    return [...entries].sort((a, b) => String(`${b.date || ''} ${b.time || ''}`).localeCompare(String(`${a.date || ''} ${a.time || ''}`)));
  }

  function row(entry) {
    const isIncoming = entry.type !== 'consumed';
    const typeBadge = isIncoming 
      ? `<span style="background:#22c55e20;color:#22c55e;padding:4px 8px;border-radius:12px;font-size:12px;font-weight:bold;">وارد</span>`
      : `<span style="background:#ef444420;color:#ef4444;padding:4px 8px;border-radius:12px;font-size:12px;font-weight:bold;">مستهلك</span>`;
    const qtyText = isIncoming 
      ? `<span style="color:#22c55e;font-weight:bold;">+${num(entry.quantityLiters)} لتر</span>`
      : `<span style="color:#ef4444;font-weight:bold;">-${num(entry.quantityLiters)} لتر</span>`;
    
    return `<tr data-dedupe-key="${esc(keyOf(entry))}">
      <td data-label="التاريخ"><strong>${esc(entry.date)}</strong><br><small>${esc(entry.day || '')} ${esc(entry.time || '')}</small></td>
      <td data-label="النوع">${typeBadge}</td>
      <td data-label="الكمية">${qtyText}</td>
      <td data-label="التفاصيل">${isIncoming ? `المورد: ${esc(entry.supplier || '-')}` : `الجهة: ${esc(entry.consumedFor || 'المولد')}`}</td>
      <td data-label="المسؤول">${isIncoming ? esc(entry.deliveredBy || '-') : esc(entry.receivedBy || '-')}</td>
      <td data-label="الإجراءات"><div class="fuel-actions"><button class="mini" type="button" onclick="WaterFuel.openFuelModal('${esc(entry.id)}')">تعديل</button><button class="mini danger" type="button" onclick="WaterFuel.deleteFuelEntry('${esc(entry.id)}')">حذف</button></div></td>
    </tr>`;
  }

  function renderStableFuelSection() {
    const section = document.getElementById('incomingFuelSection');
    if (!section) return;
    const rawEntries = Array.isArray(window.WaterFuelRawEntries) ? window.WaterFuelRawEntries : [];
    const { unique, duplicates } = uniqueEntries(sortEntries(rawEntries));
    const recent = unique.slice(0, 8);
    
    const incoming = unique.filter(x => x.type !== 'consumed').reduce((sum, item) => sum + num(item.quantityLiters), 0);
    const consumed = unique.filter(x => x.type === 'consumed').reduce((sum, item) => sum + num(item.quantityLiters), 0);
    const total = incoming - consumed;
    
    const signature = JSON.stringify(recent.map(keyOf)) + '|' + duplicates.length;
    if (signature === lastRenderSignature && section.dataset.sourceFixed === 'true') return;
    lastRenderSignature = signature;

    section.dataset.sourceFixed = 'true';
    section.innerHTML = `
      <div class="fuel-head">
        <div>
          <p class="eyebrow">إدارة السولار</p>
          <h2>آخر حركات السولار المسجلة</h2>
          <small>الوارد: <strong>${fmt(incoming)}</strong> لتر | المستهلك: <strong>${fmt(consumed)}</strong> لتر | المتبقي: <strong>${fmt(total)}</strong> لتر${duplicates.length ? ` — تم إخفاء ${duplicates.length} مكرر` : ''}</small>
        </div>
        <div class="fuel-head-actions">
          <button class="btn primary fuel-fixed-add" type="button" onclick="WaterFuel.openFuelModal()">➕ تسجيل حركة سولار</button>
          ${duplicates.length ? `<button class="btn fuel-cleanup-btn" type="button" onclick="FuelSourceFix.cleanupDuplicates()">تنظيف المكرر</button>` : ''}
        </div>
      </div>
      ${recent.length ? `<div class="fuel-table-wrap"><table class="fuel-table"><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>التفاصيل</th><th>المسؤول</th><th>الإجراءات</th></tr></thead><tbody>${recent.map(row).join('')}</tbody></table></div>` : '<div class="fuel-empty">لا توجد عمليات وقود مسجلة حتى الآن.</div>'}
    `;
  }

  async function loadEntriesOnce() {
    if (!window.firebase?.firestore) return [];
    const snap = await db().collection(COLLECTION).orderBy('date', 'desc').get();
    return sortEntries(snap.docs.map(normalize));
  }

  function interceptFuelListener() {
    const originalPatchDom = window.WaterFuel?.patchDom;
    if (!window.WaterFuel || window.WaterFuel.__sourceFixPatched) return;

    const originalOpen = window.WaterFuel.openFuelModal;
    window.WaterFuel.openFuelModal = function patchedOpen(id = null) {
      window.WaterFuel.__editingFuelId = id || null;
      return originalOpen.call(window.WaterFuel, id);
    };

    const originalClose = window.WaterFuel.closeFuelModal;
    window.WaterFuel.closeFuelModal = function patchedClose(...args) {
      window.WaterFuel.__editingFuelId = null;
      return originalClose.call(window.WaterFuel, ...args);
    };

    window.WaterFuel.patchDom = function patchedPatchDom(...args) {
      const result = originalPatchDom?.apply(window.WaterFuel, args);
      setTimeout(refreshAndRender, 50);
      return result;
    };

    const originalSave = window.WaterFuel.saveFuelEntry;
    window.WaterFuel.saveFuelEntry = async function patchedSave() {
      if (saving) return;
      saving = true;
      const btn = document.querySelector('.fuel-modal-actions .btn.primary');
      if (btn) {
        btn.disabled = true;
        btn.dataset.oldText = btn.textContent;
        btn.textContent = 'جاري الحفظ...';
      }
      try {
        const payload = window.WaterFuel.collectFuel();
        const existing = await loadEntriesOnce();
        const target = keyOf(payload);
        const editingId = window.WaterFuel.__editingFuelId || '';
        if (!editingId && existing.some(item => keyOf(item) === target)) {
          alert('هذا السجل مسجل مسبقًا بنفس البيانات. لم يتم حفظ نسخة مكررة.');
          return;
        }
        await originalSave.call(window.WaterFuel);
        setTimeout(refreshAndRender, 500);
      } catch (err) {
        alert(err?.message || 'تعذر الحفظ');
      } finally {
        saving = false;
        if (btn?.isConnected) {
          btn.disabled = false;
          btn.textContent = btn.dataset.oldText || 'حفظ سجل الوقود';
        }
      }
    };

    window.WaterFuel.__sourceFixPatched = true;
  }

  async function refreshAndRender() {
    try {
      const entries = await loadEntriesOnce();
      window.WaterFuelRawEntries = entries;
      renderStableFuelSection();
    } catch (error) {
      console.warn('Fuel source refresh failed', error);
    }
  }

  async function cleanupDuplicates() {
    try {
      const entries = await loadEntriesOnce();
      const groups = new Map();
      entries.forEach(entry => {
        const key = keyOf(entry);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(entry);
      });
      const toDelete = [];
      groups.forEach(group => {
        if (group.length > 1) toDelete.push(...group.slice(1));
      });
      if (!toDelete.length) return alert('لا توجد سجلات مكررة للتنظيف.');
      if (!confirm(`سيتم حذف ${toDelete.length} سجل مكرر وترك نسخة واحدة. هل تريد المتابعة؟`)) return;
      const batch = db().batch();
      toDelete.forEach(item => batch.delete(db().collection(COLLECTION).doc(item.id)));
      await batch.commit();
      alert(`تم حذف ${toDelete.length} سجل مكرر.`);
      await refreshAndRender();
    } catch (error) {
      console.error(error);
      alert('تعذر تنظيف المكرر.');
    }
  }

  function boot() {
    interceptFuelListener();
    refreshAndRender();
  }

  window.FuelSourceFix = { refreshAndRender, cleanupDuplicates, renderStableFuelSection };
  window.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', boot);
  setTimeout(boot, 1000);
  setInterval(renderStableFuelSection, 2000);
})();


/* ==========================================
   FILE: refresh-control.js
   ========================================== */
(() => {
  const REFRESH_PARAM = 'r';

  function ensureButton() {
    if (document.getElementById('hardRefreshBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'hardRefreshBtn';
    btn.className = 'hard-refresh-btn';
    btn.type = 'button';
    btn.title = 'تحديث قوي';
    btn.setAttribute('aria-label', 'تحديث قوي');
    btn.innerHTML = '<span>↻</span>';
    btn.addEventListener('click', hardRefresh);
    document.body.appendChild(btn);
  }

  function toast(message) {
    document.querySelectorAll('.hard-refresh-toast').forEach(el => el.remove());
    const el = document.createElement('div');
    el.className = 'hard-refresh-toast';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }

  async function hardRefresh() {
    const btn = document.getElementById('hardRefreshBtn');
    btn?.classList.add('is-loading');
    toast('جاري التحديث القوي...');

    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      }
    } catch (error) {
      console.warn('Cache clear skipped', error);
    }

    try {
      localStorage.setItem('waterAppForceRefreshAt', String(Date.now()));
    } catch {}

    const url = new URL(window.location.href);
    url.searchParams.set(REFRESH_PARAM, String(Date.now()));
    window.location.replace(url.toString());
  }

  function updateFuelLabelsOnce() {
    const cards = [...document.querySelectorAll('.kpi-card, .kpi-wide')];
    const incomingCard = cards.find(card => /إجمالي السولار المستلم|سولار مستلم|وقود وارد/.test(card.textContent || ''));
    const consumedCard = cards.find(card => /وقود مستهلك|إجمالي السولار المستهلك|وقود مستخدم/.test(card.textContent || ''));
    const stockCard = cards.find(card => /السولار في المخزون|آخر رصيد|وقود متبقي/.test(card.textContent || ''));

    if (incomingCard) {
      const span = incomingCard.querySelector('span');
      const small = incomingCard.querySelector('small');
      if (span) span.textContent = 'وقود وارد';
      if (small) small.textContent = 'من زر إضافة وقود وارد';
      incomingCard.classList.add('fuel-incoming-kpi');
    }
    if (consumedCard) {
      const span = consumedCard.querySelector('span');
      const small = consumedCard.querySelector('small');
      if (span) span.textContent = 'وقود مستخدم';
      if (small) small.textContent = 'من استهلاك التقارير اليومية';
      consumedCard.classList.add('fuel-consumed-kpi');
    }
    if (stockCard) {
      const span = stockCard.querySelector('span');
      const small = stockCard.querySelector('small');
      if (span) span.textContent = 'وقود متبقي';
      if (small) small.textContent = 'الوارد - المستخدم';
      stockCard.classList.add('fuel-remaining-kpi');
    }
  }

  function start() {
    ensureButton();
    updateFuelLabelsOnce();
    setTimeout(updateFuelLabelsOnce, 500);
    setTimeout(updateFuelLabelsOnce, 1800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();


