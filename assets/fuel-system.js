/* --- Unified Module: fuel-system.js --- */

/* ==========================================
   Authoritative Fuel Management & Accounting System
   ========================================== */
(function () {
  const COLLECTION = 'fuelEntries';
  const state = {
    entries: [],
    rawEntries: [],
    duplicates: [],
    unsubscribe: null,
    observerStarted: false,
    editingId: null,
    saving: false
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function num(value) {
    return window.ReportUtils ? window.ReportUtils.number(value) : Number(String(value ?? '').replace(',', '.').replace(/[^0-9.\-]/g, '')) || 0;
  }

  function fmt(value, digits = 2) {
    const n = num(value);
    const r = +n.toFixed(digits);
    return Number.isInteger(r) ? String(r) : String(r);
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function timeNow() {
    return new Date().toTimeString().slice(0, 5);
  }

  function dayName(date = today()) {
    try {
      return new Date(`${date}T12:00:00`).toLocaleDateString('ar', { weekday: 'long' });
    } catch {
      return '';
    }
  }

  function db() {
    if (!window.firebase?.firestore) throw new Error('Firebase Firestore غير متاح.');
    return firebase.firestore();
  }

  function serverTime() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function userName() {
    return window.AuthUsers?.currentUser?.()?.fullName || window.WATER_APP_SETTINGS?.defaultUserName || 'صالح الدحنون';
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
      if (seen.has(key)) {
        duplicates.push(item);
      } else {
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
        renderStableFuelSection();
      }, error => {
        console.warn('fuelEntries listener error', error);
        setEntries([]);
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

  function row(entry) {
    const isIncoming = entry.type !== 'consumed';
    const typeBadge = isIncoming
      ? `<span style="background:#22c55e20;color:#22c55e;padding:4px 8px;border-radius:12px;font-size:12px;font-weight:bold;">وارد</span>`
      : `<span style="background:#ef444420;color:#ef4444;padding:4px 8px;border-radius:12px;font-size:12px;font-weight:bold;">مستهلك</span>`;
    const qtyText = isIncoming
      ? `<span style="color:#22c55e;font-weight:bold;">+${num(entry.quantityLiters)} لتر</span>`
      : `<span style="color:#ef4444;font-weight:bold;">-${num(entry.quantityLiters)} لتر</span>`;

    return `<tr>
      <td data-label="التاريخ"><strong>${esc(entry.date)}</strong><br><small>${esc(entry.day || '')} ${esc(entry.time || '')}</small></td>
      <td data-label="النوع">${typeBadge}</td>
      <td data-label="الكمية">${qtyText}</td>
      <td data-label="التفاصيل">${isIncoming ? `المورد: ${esc(entry.supplier || '-')}` : `الجهة: ${esc(entry.consumedFor || 'المولد')}`}</td>
      <td data-label="المسؤول">${isIncoming ? esc(entry.deliveredBy || '-') : esc(entry.receivedBy || '-')}</td>
      <td data-label="الإجراءات"><div class="fuel-actions"><button class="mini" type="button" onclick="WaterFuel.openFuelModal('${esc(entry.id)}')">تعديل</button><button class="mini danger" type="button" onclick="WaterFuel.deleteFuelEntry('${esc(entry.id)}')">حذف</button></div></td>
    </tr>`;
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

    const appState = window.App?.state;
    if (appState && appState.view !== 'home') {
      section.style.display = 'none';
    } else {
      section.style.display = 'block';
      renderStableFuelSection();
    }
  }

  function renderStableFuelSection() {
    const section = document.getElementById('incomingFuelSection');
    if (!section) return;
    const rawEntries = Array.isArray(window.WaterFuelRawEntries) ? window.WaterFuelRawEntries : [];
    const { unique, duplicates } = splitUnique(rawEntries);
    const recent = unique.slice(0, 8);

    const incoming = unique.filter(x => x.type !== 'consumed').reduce((sum, item) => sum + num(item.quantityLiters), 0);
    const consumed = (window.App?.state?.reports || []).reduce((sum, r) => sum + num(r?.fuel?.consumedDaily), 0);
    const stock = incoming - consumed;

    section.dataset.sourceFixed = 'true';
    section.innerHTML = `
      <div class="fuel-head">
        <div>
          <p class="eyebrow">إدارة السولار</p>
          <h2>آخر حركات السولار المسجلة</h2>
          <small>الوارد الكلي: <strong>${fmt(incoming)}</strong> لتر | المستهلك الكلي: <strong>${fmt(consumed)}</strong> لتر | الرصيد المتبقي: <strong>${fmt(stock)}</strong> لتر${duplicates.length ? ` — تم إخفاء ${duplicates.length} مكرر` : ''}</small>
        </div>
        <div class="fuel-head-actions">
          <button class="btn primary fuel-fixed-add" type="button" onclick="WaterFuel.openFuelModal()">➕ تسجيل حركة سولار</button>
          ${duplicates.length ? `<button class="btn fuel-cleanup-btn" type="button" onclick="WaterFuel.cleanupDuplicateFuelEntries()">تنظيف المكرر (${duplicates.length})</button>` : ''}
        </div>
      </div>
      ${recent.length ? `<div class="fuel-table-wrap"><table class="fuel-table"><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية</th><th>التفاصيل</th><th>المسؤول</th><th>الإجراءات</th></tr></thead><tbody>${recent.map(row).join('')}</tbody></table></div>` : '<div class="fuel-empty">لا توجد عمليات وقود مسجلة حتى الآن.</div>'}
    `;
  }

  function defaultEntry() {
    const date = today();
    return {
      type: 'incoming',
      day: dayName(date),
      date,
      time: timeNow(),
      supplier: '',
      source: 'municipality',
      quantityLiters: '',
      fillingMethod: 'فرد تعبئة',
      deliveredBy: '',
      notes: '',
      consumedFor: 'المولد الكهربائي',
      receivedBy: ''
    };
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
        <div class="modal-title"><span>⛽</span><div><h2>${state.editingId ? 'تعديل حركة السولار' : 'تسجيل حركة سولار'}</h2><p>يتم حفظ هذا السجل في سجلات الوقود المستقلة.</p></div></div>
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
      type,
      day: clean(data.get('day')),
      date: clean(data.get('date')),
      time: clean(data.get('time')),
      notes: clean(data.get('notes'))
    };

    if (type === 'consumed') {
      payload.quantityLiters = num(data.get('quantityConsumed'));
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
      payload.quantityLiters = num(data.get('quantityLiters'));
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
    if (state.saving) return;
    state.saving = true;
    const btn = document.querySelector('#fuelEntryModal .fuel-modal-actions .btn.primary');
    try {
      if (!configured()) throw new Error('Firebase غير متاح أو غير مهيأ.');
      const payload = { ...collectFuel(), updatedAt: serverTime(), updatedBy: userName() };
      if (duplicateExists(payload)) throw new Error('هذا السجل مسجل مسبقًا بنفس البيانات.');
      if (btn) { btn.disabled = true; btn.textContent = 'جاري الحفظ...'; }

      if (state.editingId) {
        await db().collection(COLLECTION).doc(state.editingId).set(payload, { merge: true });
        toast('تم تعديل سجل الوقود بنجاح', 'ok');
      } else {
        await db().collection(COLLECTION).add({ ...payload, createdAt: serverTime(), createdBy: userName() });
        toast('تم حفظ سجل الوقود بنجاح', 'ok');
      }
      closeFuelModal();
    } catch (error) {
      toast(error?.message || 'تعذر حفظ سجل الوقود', 'warn');
      console.error(error);
    } finally {
      state.saving = false;
      if (btn?.isConnected) { btn.disabled = false; btn.textContent = 'حفظ سجل الوقود'; }
    }
  }

  async function deleteFuelEntry(id) {
    if (!id || !confirm('هل تريد حذف سجل الوقود؟')) return;
    try {
      await db().collection(COLLECTION).doc(id).delete();
      toast('تم حذف سجل الوقود', 'ok');
    } catch (error) {
      toast('تعذر حذف سجل الوقود', 'warn');
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
      toast(`تم حذف ${state.duplicates.length} سجل مكرر بنجاح.`, 'ok');
    } catch (error) {
      toast('تعذر تنظيف السجلات المكررة.', 'warn');
      console.error(error);
    }
  }

  function openExportCenter() {
    if (window.ExportV4?.open) {
      window.ExportV4.open();
    }
  }

  function closeExportCenter() {
    if (window.ExportV4?.close) window.ExportV4.close();
  }

  function patchDom() {
    startListener();
    ensureHeroButtons();
    ensureFuelSection();
  }

  function init() {
    if (state.observerStarted) return;
    state.observerStarted = true;
    window.addEventListener('DOMContentLoaded', () => setTimeout(patchDom, 300));
  }

  window.WaterFuel = {
    openFuelModal,
    closeFuelModal,
    syncFuelDay,
    collectFuel,
    saveFuelEntry,
    deleteFuelEntry,
    cleanupDuplicateFuelEntries,
    openExportCenter,
    closeExportCenter,
    toggleMoreMenu,
    patchDom,
    toggleFuelFields,
    renderStableFuelSection
  };

  window.FuelSourceFix = {
    refreshAndRender: renderStableFuelSection,
    cleanupDuplicates: cleanupDuplicateFuelEntries,
    renderStableFuelSection
  };

  init();
})();

/* ==========================================
   Hard Refresh Controller
   ========================================== */
(() => {
  function ensureButton() {
    if (document.getElementById('hardRefreshBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'hardRefreshBtn';
    btn.className = 'hard-refresh-btn';
    btn.type = 'button';
    btn.title = 'تحديث قوي للبيانات';
    btn.setAttribute('aria-label', 'تحديث قوي للبيانات');
    btn.innerHTML = '<span>↻</span>';
    btn.addEventListener('click', hardRefresh);
    document.body.appendChild(btn);
  }

  async function hardRefresh() {
    const btn = document.getElementById('hardRefreshBtn');
    btn?.classList.add('is-loading');

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
    url.searchParams.set('r', String(Date.now()));
    window.location.replace(url.toString());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureButton);
  } else {
    ensureButton();
  }
})();
