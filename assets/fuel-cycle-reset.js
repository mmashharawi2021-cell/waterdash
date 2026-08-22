(() => {
  const VERSION = '20260821-fuel-cycle-reset-1';
  const START = '2026-08-21';

  const num = value => {
    if (window.ReportUtils?.number) return window.ReportUtils.number(value);
    const n = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = value => {
    const r = +num(value).toFixed(2);
    return String(r);
  };
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();

  function uniqueEntries(entries) {
    const seen = new Set();
    return entries.filter(entry => {
      const key = [clean(entry.date), clean(entry.time), clean(entry.supplier || entry.donor), fmt(entry.quantityLiters ?? entry.quantity), clean(entry.fillingMethod), clean(entry.deliveredBy)].join('|');
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

  async function summary() {
    if (!window.firebase?.firestore) return null;
    const db = firebase.firestore();
    const [fuelSnap, reportsSnap] = await Promise.all([
      db.collection('fuelEntries').get(),
      db.collection('reports').get()
    ]);
    const incomingEntries = uniqueEntries(fuelSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) })))
      .filter(entry => entry.date && entry.date >= START);
    const incoming = incomingEntries.reduce((sum, entry) => sum + num(entry.quantityLiters ?? entry.quantity), 0);
    const used = reportsSnap.docs.reduce((sum, doc) => {
      const data = doc.data() || {};
      if (!data.reportDate || data.reportDate < START) return sum;
      return sum + num(data?.fuel?.consumedDaily);
    }, 0);
    return { incoming, used, remaining: incoming - used };
  }

  async function updateKpis() {
    try {
      const s = await summary();
      if (!s) return;
      document.documentElement.dataset.fuelCycleReset = VERSION;
      document.documentElement.dataset.fuelCycleStart = START;
      const hint = `الدورة الحالية من ${window.ReportUtils?.displayDate ? window.ReportUtils.displayDate(START) : START}`;
      setCard(findCard([/إجمالي السولار المستلم/, /سولار مستلم/, /وقود وارد/]), 'وقود وارد', s.incoming, hint);
      setCard(findCard([/وقود مستهلك/, /إجمالي السولار المستهلك/, /وقود مستخدم/]), 'وقود مستخدم', s.used, hint);
      setCard(findCard([/السولار في المخزون/, /آخر رصيد/, /وقود متبقي/]), 'وقود متبقي', s.remaining, 'الوارد - المستخدم للدورة الحالية');
    } catch (error) {
      console.warn('fuel cycle KPI reset skipped', error);
    }
  }

  async function currentCyclePreviousBalance(reportDate) {
    if (!reportDate || reportDate <= START || !window.firebase?.firestore) return 0;
    try {
      const snap = await firebase.firestore().collection('reports')
        .where('reportDate', '>=', START)
        .where('reportDate', '<', reportDate)
        .orderBy('reportDate', 'desc')
        .limit(1)
        .get();
      if (snap.empty) return 0;
      return num(snap.docs[0].data()?.fuel?.currentBalance);
    } catch (error) {
      console.warn('fuel cycle previous balance lookup skipped', error);
      return 0;
    }
  }

  let formToken = 0;
  async function enforceFormCycle() {
    const form = document.getElementById('reportForm');
    if (!form) return;
    const dateInput = form.querySelector('[name="reportDate"]');
    const prevInput = form.querySelector('[name="fuelPrevious"]');
    if (!dateInput || !prevInput) return;
    const reportDate = String(dateInput.value || '');
    if (!reportDate || reportDate < START) return;
    const token = ++formToken;
    const previous = await currentCyclePreviousBalance(reportDate);
    if (token !== formToken || !document.body.contains(form)) return;
    prevInput.value = fmt(previous);
    prevInput.dispatchEvent(new Event('input', { bubbles: true }));
    prevInput.dataset.fuelCycleStart = START;
  }

  function patchDuplicate() {
    if (!window.App || window.App.__fuelCycleDuplicatePatched) return;
    const original = window.App.duplicateLastReport;
    if (typeof original !== 'function') return;
    window.App.duplicateLastReport = async function fuelCycleDuplicate() {
      const result = await original.apply(this, arguments);
      setTimeout(enforceFormCycle, 0);
      setTimeout(enforceFormCycle, 250);
      return result;
    };
    window.App.__fuelCycleDuplicatePatched = true;
  }

  function run() {
    patchDuplicate();
    updateKpis();
    enforceFormCycle();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  setTimeout(run, 700);
  setTimeout(run, 2200);
  setTimeout(run, 5000);

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
