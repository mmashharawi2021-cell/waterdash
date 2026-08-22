(() => {
  const VERSION = '20260822-fuel-cycle-reset-4';
  const RESET_DOC = 'fuelCycleReset';
  const RESET_COLLECTION = 'settings';
  const num = value => {
    if (window.ReportUtils?.number) return window.ReportUtils.number(value);
    const n = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = value => String(+num(value).toFixed(2));
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  let resetMarker = null;
  let markerPromise = null;

  function db() { return window.firebase?.firestore ? firebase.firestore() : null; }
  function tsMillis(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (value.seconds != null) return Number(value.seconds) * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1e6);
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function uniqueEntries(entries) {
    const seen = new Set();
    return entries.filter(entry => {
      const key = [clean(entry.type || 'incoming'), clean(entry.date), clean(entry.time), clean(entry.supplier || entry.donor || entry.consumedFor), fmt(entry.quantityLiters ?? entry.quantity), clean(entry.fillingMethod), clean(entry.deliveredBy || entry.receivedBy)].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function findCard(patterns) {
    return [...document.querySelectorAll('.kpi-card, .kpi-wide')].find(card => patterns.some(re => re.test(card.textContent || ''))) || null;
  }
  function setCard(card, label, value, hint) {
    if (!card) return;
    const span = card.querySelector('span');
    const strong = card.querySelector('strong');
    const small = card.querySelector('small');
    if (span) span.textContent = label;
    if (strong) strong.textContent = fmt(value);
    if (small) small.textContent = hint;
  }
  function markerLabel(marker) {
    const ms = tsMillis(marker?.startedAt);
    if (!ms) return 'من نقطة التصفير';
    try { return `من ${new Date(ms).toLocaleString('ar-PS')}`; } catch { return 'من نقطة التصفير'; }
  }

  async function ensureResetMarker() {
    if (resetMarker?.startedAt) return resetMarker;
    if (markerPromise) return markerPromise;
    markerPromise = (async () => {
      const firestore = db();
      if (!firestore) return null;
      const ref = firestore.collection(RESET_COLLECTION).doc(RESET_DOC);
      let snap = await ref.get();
      if (!snap.exists || !snap.data()?.startedAt) {
        await ref.set({
          startedAt: firebase.firestore.FieldValue.serverTimestamp(),
          cycleId: 'fuel-cycle-2026-08-22',
          reason: 'Manual fuel accounting reset; historical records preserved',
          version: VERSION
        }, { merge: true });
        snap = await ref.get();
      }
      resetMarker = snap.exists ? snap.data() : null;
      return resetMarker;
    })().finally(() => { markerPromise = null; });
    return markerPromise;
  }

  function isAfterReset(data, marker, timestampField = 'createdAt') {
    const resetMs = tsMillis(marker?.startedAt);
    const itemMs = tsMillis(data?.[timestampField]);
    return Boolean(resetMs && itemMs && itemMs > resetMs);
  }

  async function summary() {
    const firestore = db();
    const marker = await ensureResetMarker();
    if (!firestore || !marker?.startedAt) return null;
    const [fuelSnap, reportsSnap] = await Promise.all([
      firestore.collection('fuelEntries').get(),
      firestore.collection('reports').get()
    ]);
    const incomingEntries = uniqueEntries(fuelSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) })))
      .filter(entry => entry.type !== 'consumed' && isAfterReset(entry, marker));
    const incoming = incomingEntries.reduce((sum, entry) => sum + num(entry.quantityLiters ?? entry.quantity), 0);
    const used = reportsSnap.docs.reduce((sum, doc) => {
      const data = doc.data() || {};
      if (!isAfterReset(data, marker)) return sum;
      return sum + num(data?.fuel?.consumedDaily ?? data?.fuel?.consumedFuel);
    }, 0);
    return { incoming, used, remaining: incoming - used, marker };
  }

  async function updateKpis() {
    try {
      const s = await summary();
      if (!s) return;
      document.documentElement.dataset.fuelCycleReset = VERSION;
      document.documentElement.dataset.fuelCycleStart = String(tsMillis(s.marker.startedAt));
      const hint = markerLabel(s.marker);
      setCard(findCard([/إجمالي السولار المستلم/, /سولار مستلم/, /وقود وارد/, /الوقود المزود/, /الوقود المتاح للدورة/, /الوقود الوارد للدورة/]), 'الوقود الوارد للدورة', s.incoming, hint);
      setCard(findCard([/وقود مستهلك/, /إجمالي السولار المستهلك/, /وقود مستخدم/, /الوقود المستهلك/, /الوقود المستهلك للدورة/]), 'الوقود المستهلك للدورة', s.used, hint);
      setCard(findCard([/السولار في المخزون/, /آخر رصيد/, /وقود متبقي/, /مؤشر رصيد السولار/, /رصيد السولار الحالي/]), 'رصيد السولار الحالي', s.remaining, 'الوارد بعد التصفير - المستهلك بعد التصفير');
    } catch (error) { console.warn('fuel cycle KPI reset skipped', error); }
  }

  async function previousCycleBalanceForReport(reportDate, editingId = null) {
    const firestore = db();
    const marker = await ensureResetMarker();
    if (!firestore || !marker?.startedAt) return 0;
    const [fuelSnap, reportsSnap] = await Promise.all([
      firestore.collection('fuelEntries').get(),
      firestore.collection('reports').get()
    ]);
    const incomingBefore = uniqueEntries(fuelSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) })))
      .filter(entry => entry.type !== 'consumed' && isAfterReset(entry, marker) && (!reportDate || !entry.date || entry.date < reportDate))
      .reduce((sum, entry) => sum + num(entry.quantityLiters ?? entry.quantity), 0);
    const consumedBefore = reportsSnap.docs.reduce((sum, doc) => {
      if (editingId && doc.id === editingId) return sum;
      const data = doc.data() || {};
      if (!isAfterReset(data, marker)) return sum;
      if (reportDate && data.reportDate && data.reportDate >= reportDate) return sum;
      return sum + num(data?.fuel?.consumedDaily ?? data?.fuel?.consumedFuel);
    }, 0);
    return incomingBefore - consumedBefore;
  }

  let formToken = 0;
  async function enforceFormCycle() {
    const form = document.getElementById('reportForm');
    if (!form) return;
    const dateInput = form.querySelector('[name="reportDate"]');
    const prevInput = form.querySelector('[name="fuelPrevious"]');
    if (!dateInput || !prevInput) return;
    const token = ++formToken;
    const reportDate = String(dateInput.value || '');
    const editingId = window.App?.state?.editingId || null;
    const previous = await previousCycleBalanceForReport(reportDate, editingId);
    if (token !== formToken || !document.body.contains(form)) return;
    prevInput.value = fmt(previous);
    prevInput.dataset.fuelCycleReset = VERSION;
    prevInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function patchDuplicate() {
    if (!window.App || window.App.__fuelCycleDuplicatePatched) return;
    const original = window.App.duplicateLastReport;
    if (typeof original !== 'function') return;
    window.App.duplicateLastReport = async function () {
      const result = await original.apply(this, arguments);
      setTimeout(enforceFormCycle, 0);
      setTimeout(enforceFormCycle, 250);
      return result;
    };
    window.App.__fuelCycleDuplicatePatched = true;
  }

  function run() { patchDuplicate(); updateKpis(); enforceFormCycle(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  setTimeout(run, 700); setTimeout(run, 2200); setTimeout(run, 5000);
  const observer = new MutationObserver(() => {
    clearTimeout(window.__fuelCycleResetTimer);
    window.__fuelCycleResetTimer = setTimeout(run, 120);
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }));
  document.addEventListener('change', event => {
    if (event.target?.matches?.('[name="reportDate"]')) setTimeout(enforceFormCycle, 0);
  }, true);
  try { firebase.auth().onAuthStateChanged(() => setTimeout(run, 500)); } catch {}
})();
