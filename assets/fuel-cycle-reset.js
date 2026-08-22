(() => {
  const VERSION = '20260822-fuel-cycle-reset-6';
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
  let refreshTimer = null;
  let listenersStarted = false;

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
  function setText(el, value) {
    if (el && el.textContent !== String(value)) el.textContent = String(value);
  }
  function setCard(card, label, value, hint) {
    if (!card) return;
    setText(card.querySelector('span'), label);
    setText(card.querySelector('strong'), fmt(value));
    setText(card.querySelector('small'), hint);
    card.dataset.fuelCycleReset = VERSION;
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
    const cycleReports = reportsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) })).filter(data => isAfterReset(data, marker));
    const used = cycleReports.reduce((sum, data) => sum + num(data?.fuel?.consumedDaily ?? data?.fuel?.consumedFuel), 0);
    return { incoming, used, remaining: incoming - used, marker, cycleReports };
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
      suppressLegacyFuelAlerts();
    } catch (error) { console.warn('fuel cycle KPI reset skipped', error); }
  }

  function scheduleRefresh(delay = 30) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(updateKpis, delay);
  }

  function isFuelOperationalAlert(node) {
    const text = clean(node?.textContent);
    return /(?:رصيد|مخزون)\s*(?:الديزل|السولار|الوقود)|(?:الديزل|السولار|الوقود).*?(?:يكفي|منخفض|نفاد|رصيد)/.test(text);
  }
  function suppressLegacyFuelAlerts() {
    [...document.querySelectorAll('.smart-warning, .notice, [class*="alert"], [class*="warning"]')].forEach(node => {
      if (!isFuelOperationalAlert(node)) return;
      node.dataset.fuelCycleLegacyAlert = 'hidden';
      node.style.setProperty('display', 'none', 'important');
    });
  }
  function patchWarningRenderer() {
    if (!window.WarningSkipActions || window.WarningSkipActions.__fuelCyclePatched) return;
    const originalVisible = window.WarningSkipActions.visibleWarnings;
    const originalRender = window.WarningSkipActions.renderWarnings;
    if (typeof originalVisible === 'function') {
      window.WarningSkipActions.visibleWarnings = function(report) {
        const list = originalVisible.call(this, report) || [];
        return list.filter(message => !/(?:رصيد|مخزون)\s*(?:الديزل|السولار|الوقود)|(?:الديزل|السولار|الوقود).*?(?:يكفي|منخفض|نفاد|رصيد)/.test(clean(message)));
      };
    }
    if (typeof originalRender === 'function') {
      window.WarningSkipActions.renderWarnings = function(report) {
        const html = originalRender.call(this, report);
        setTimeout(suppressLegacyFuelAlerts, 0);
        return html;
      };
    }
    window.WarningSkipActions.__fuelCyclePatched = true;
  }

  function patchAppRender() {
    if (!window.App || window.App.__fuelCycleRenderPatched || typeof window.App.render !== 'function') return;
    const original = window.App.render;
    window.App.render = function() {
      const result = original.apply(this, arguments);
      scheduleRefresh(0);
      setTimeout(updateKpis, 100);
      setTimeout(updateKpis, 350);
      return result;
    };
    window.App.__fuelCycleRenderPatched = true;
  }

  function startDataListeners() {
    if (listenersStarted || !db()) return;
    listenersStarted = true;
    try {
      db().collection('fuelEntries').onSnapshot(() => scheduleRefresh(20), err => console.warn('fuel cycle fuel listener', err));
      db().collection('reports').onSnapshot(() => scheduleRefresh(20), err => console.warn('fuel cycle reports listener', err));
      db().collection(RESET_COLLECTION).doc(RESET_DOC).onSnapshot(snap => {
        if (snap.exists) resetMarker = snap.data();
        scheduleRefresh(20);
      }, err => console.warn('fuel cycle marker listener', err));
    } catch (error) { console.warn('fuel cycle listeners skipped', error); }
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
      .filter(entry => entry.type !== 'consumed' && isAfterReset(entry, marker) && (!reportDate || !entry.date || entry.date <= reportDate))
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

  function run() {
    patchAppRender();
    patchDuplicate();
    patchWarningRenderer();
    startDataListeners();
    scheduleRefresh(0);
    enforceFormCycle();
    suppressLegacyFuelAlerts();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  setTimeout(run, 500); setTimeout(run, 1500); setTimeout(run, 4000);
  const observer = new MutationObserver(mutations => {
    const meaningful = mutations.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && !n.closest?.('[data-fuel-cycle-reset]')));
    if (meaningful) scheduleRefresh(80);
    suppressLegacyFuelAlerts();
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }));
  document.addEventListener('change', event => {
    if (event.target?.matches?.('[name="reportDate"]')) setTimeout(enforceFormCycle, 0);
  }, true);
  try { firebase.auth().onAuthStateChanged(() => setTimeout(run, 300)); } catch {}
})();
