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

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function q(value) {
    return num(value).toFixed(2);
  }

  function keyOf(item) {
    return [
      clean(item.date),
      clean(item.time),
      clean(item.supplier || item.donor),
      q(item.quantityLiters ?? item.quantity),
      clean(item.fillingMethod),
      clean(item.deliveredBy)
    ].join('|');
  }

  function normalize(doc) {
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
      notes: data.notes || '',
      createdAt: data.createdAt || null
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
    return `<tr data-dedupe-key="${esc(keyOf(entry))}">
      <td data-label="التاريخ"><strong>${esc(entry.date)}</strong><br><small>${esc(entry.day || '')} ${esc(entry.time || '')}</small></td>
      <td data-label="المورد">${esc(entry.supplier || '-')}</td>
      <td data-label="الكمية"><strong>${num(entry.quantityLiters)}</strong> لتر</td>
      <td data-label="طريقة التعبئة">${esc(entry.fillingMethod || '-')}</td>
      <td data-label="المسلّم">${esc(entry.deliveredBy || '-')}</td>
      <td data-label="الإجراءات"><div class="fuel-actions"><button class="mini" type="button" onclick="WaterFuel.openFuelModal('${esc(entry.id)}')">تعديل</button><button class="mini danger" type="button" onclick="WaterFuel.deleteFuelEntry('${esc(entry.id)}')">حذف</button></div></td>
    </tr>`;
  }

  function renderStableFuelSection() {
    const section = document.getElementById('incomingFuelSection');
    if (!section) return;
    const rawEntries = Array.isArray(window.WaterFuelRawEntries) ? window.WaterFuelRawEntries : [];
    const { unique, duplicates } = uniqueEntries(sortEntries(rawEntries));
    const recent = unique.slice(0, 8);
    const total = unique.reduce((sum, item) => sum + num(item.quantityLiters), 0);
    const signature = JSON.stringify(recent.map(keyOf)) + '|' + duplicates.length;
    if (signature === lastRenderSignature && section.dataset.sourceFixed === 'true') return;
    lastRenderSignature = signature;

    section.dataset.sourceFixed = 'true';
    section.innerHTML = `
      <div class="fuel-head">
        <div>
          <p class="eyebrow">الوقود الوارد</p>
          <h2>آخر عمليات الوقود الوارد</h2>
          <small>إجمالي الوقود الوارد المسجل: ${Number.isInteger(total) ? total : +total.toFixed(2)} لتر${duplicates.length ? ` — تم إخفاء ${duplicates.length} سجل مكرر` : ''}</small>
        </div>
        <div class="fuel-head-actions">
          <button class="btn primary fuel-fixed-add" type="button" onclick="WaterFuel.openFuelModal()">➕ إضافة وقود وارد</button>
          ${duplicates.length ? `<button class="btn fuel-cleanup-btn" type="button" onclick="FuelSourceFix.cleanupDuplicates()">تنظيف المكرر</button>` : ''}
        </div>
      </div>
      ${recent.length ? `<div class="fuel-table-wrap"><table class="fuel-table"><thead><tr><th>التاريخ</th><th>المورد</th><th>الكمية</th><th>طريقة التعبئة</th><th>المسلّم</th><th>الإجراءات</th></tr></thead><tbody>${recent.map(row).join('')}</tbody></table></div>` : '<div class="fuel-empty">لا توجد عمليات وقود وارد محفوظة حتى الآن.</div>'}
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
        const form = document.getElementById('fuelEntryForm');
        const data = new FormData(form);
        const payload = {
          date: data.get('date'),
          time: data.get('time'),
          supplier: data.get('supplier'),
          quantityLiters: data.get('quantityLiters'),
          fillingMethod: data.get('fillingMethod'),
          deliveredBy: data.get('deliveredBy')
        };
        const existing = await loadEntriesOnce();
        const target = keyOf(payload);
        const editingId = window.WaterFuel.__editingFuelId || '';
        if (!editingId && existing.some(item => keyOf(item) === target)) {
          alert('هذا الوقود الوارد مسجل مسبقًا بنفس البيانات. لم يتم حفظ نسخة مكررة.');
          return;
        }
        await originalSave.call(window.WaterFuel);
        setTimeout(refreshAndRender, 500);
      } finally {
        saving = false;
        if (btn?.isConnected) {
          btn.disabled = false;
          btn.textContent = btn.dataset.oldText || 'حفظ الوقود الوارد';
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
