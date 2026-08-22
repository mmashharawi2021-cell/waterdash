(() => {
  const VERSION = '20260822-fuel-accounting-unified-2';
  const RESET_COLLECTION = 'settings';
  const RESET_DOC = 'fuelCycleReset';

  const num = value => {
    if (window.ReportUtils?.number) return window.ReportUtils.number(value);
    const n = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = value => +num(value).toFixed(2);
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const db = () => window.firebase?.firestore ? firebase.firestore() : null;
  const tsMillis = value => {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (value.seconds != null) return Number(value.seconds) * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1e6);
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const clone = value => {
    try { return structuredClone(value); }
    catch { return JSON.parse(JSON.stringify(value || {})); }
  };
  const uniqueEntries = entries => {
    const seen = new Set();
    return entries.filter(entry => {
      const key = [clean(entry.type || 'incoming'), clean(entry.date), clean(entry.time), clean(entry.supplier || entry.donor || entry.consumedFor), fmt(entry.quantityLiters ?? entry.quantity), clean(entry.fillingMethod), clean(entry.deliveredBy || entry.receivedBy)].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  async function loadCycleData() {
    const firestore = db();
    if (!firestore) return null;
    const markerSnap = await firestore.collection(RESET_COLLECTION).doc(RESET_DOC).get();
    if (!markerSnap.exists || !markerSnap.data()?.startedAt) return null;
    const marker = markerSnap.data();
    const resetMs = tsMillis(marker.startedAt);
    const [fuelSnap, reportsSnap] = await Promise.all([
      firestore.collection('fuelEntries').get(),
      firestore.collection('reports').get()
    ]);
    const afterReset = data => {
      const ms = tsMillis(data?.createdAt);
      return Boolean(resetMs && ms && ms > resetMs);
    };
    const fuels = uniqueEntries(fuelSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) })))
      .filter(entry => entry.type !== 'consumed' && afterReset(entry));
    const reports = reportsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) })).filter(afterReset);
    return { marker, fuels, reports };
  }

  function contextFromData(data, reportDate, editingId = null, consumed = 0) {
    if (!data) return null;
    const available = data.fuels
      .filter(entry => !reportDate || !entry.date || entry.date <= reportDate)
      .reduce((sum, entry) => sum + num(entry.quantityLiters ?? entry.quantity), 0);
    const earlierConsumption = data.reports.reduce((sum, report) => {
      if (editingId && report.id === editingId) return sum;
      if (reportDate && report.reportDate && report.reportDate >= reportDate) return sum;
      return sum + num(report?.fuel?.consumedDaily ?? report?.fuel?.consumedFuel);
    }, 0);
    const previousBalance = fmt(available - earlierConsumption);
    const currentBalance = fmt(previousBalance - consumed);
    return { previousBalance, currentBalance, loss: 0, cycleId: data.marker.cycleId || 'fuel-cycle', resetStartedAt: data.marker.startedAt };
  }

  async function contextFor(reportDate, editingId = null, consumed = 0) {
    return contextFromData(await loadCycleData(), reportDate, editingId, consumed);
  }

  async function normalizeReport(report, existingId = null, cycleData = null) {
    if (!report) return report;
    const next = clone(report);
    next.fuel = next.fuel || {};
    const data = cycleData || await loadCycleData();
    if (!data) return next;
    const resetMs = tsMillis(data.marker.startedAt);
    const createdMs = tsMillis(next.createdAt);
    const isPostReset = next.fuel.accountingMode === 'post-reset-unified' || (createdMs && createdMs > resetMs) || data.reports.some(r => r.id === (existingId || next.id));
    if (!isPostReset && existingId == null && !next.id) {
      // New report being created now belongs to the active cycle.
    } else if (!isPostReset) {
      return next;
    }
    const ctx = contextFromData(data, next.reportDate, existingId || next.id || null, num(next.fuel.consumedDaily ?? next.fuel.consumedFuel));
    if (!ctx) return next;
    next.fuel.previousBalance = ctx.previousBalance;
    next.fuel.currentBalance = ctx.currentBalance;
    next.fuel.loss = ctx.loss;
    next.fuel.accountingCycleId = ctx.cycleId;
    next.fuel.accountingMode = 'post-reset-unified';
    next.fuel.accountingVersion = VERSION;
    return next;
  }

  async function normalizeReports(reports) {
    const data = await loadCycleData();
    if (!data) return (reports || []).map(clone);
    return Promise.all((reports || []).map(report => normalizeReport(report, report?.id || null, data)));
  }

  function patchSave() {
    if (!window.FirebaseService || window.FirebaseService.__fuelAccountingUnified === VERSION) return;
    const originalSave = window.FirebaseService.saveReport;
    if (typeof originalSave !== 'function') return;
    if (!window.FirebaseService.__fuelAccountingOriginalSave) window.FirebaseService.__fuelAccountingOriginalSave = originalSave;
    window.FirebaseService.saveReport = async function(report, user, existingId) {
      const normalized = await normalizeReport(report, existingId);
      return window.FirebaseService.__fuelAccountingOriginalSave.call(this, normalized, user, existingId);
    };
    window.FirebaseService.__fuelAccountingUnified = VERSION;
  }

  function patchReportText() {
    if (!window.ReportUtils || window.ReportUtils.__fuelAccountingTextPatched === VERSION) return;
    const originalWhatsapp = window.ReportUtils.whatsappText;
    if (typeof originalWhatsapp !== 'function') return;
    if (!window.ReportUtils.__fuelAccountingOriginalWhatsapp) window.ReportUtils.__fuelAccountingOriginalWhatsapp = originalWhatsapp;
    window.ReportUtils.whatsappText = function(report) {
      // Synchronous render uses already-normalized report. Export hooks normalize before calling it.
      return window.ReportUtils.__fuelAccountingOriginalWhatsapp.call(this, report);
    };
    window.ReportUtils.__fuelAccountingTextPatched = VERSION;
  }

  async function enforceForm() {
    const form = document.getElementById('reportForm');
    if (!form) return;
    const date = form.querySelector('[name="reportDate"]')?.value || '';
    const consumed = num(form.querySelector('[name="fuelConsumed"]')?.value);
    const editingId = window.App?.state?.editingId || null;
    const ctx = await contextFor(date, editingId, consumed);
    if (!ctx || !document.body.contains(form)) return;
    const prev = form.querySelector('[name="fuelPrevious"]');
    const current = form.querySelector('[name="fuelCurrent"]');
    const loss = form.querySelector('[name="fuelLoss"]');
    if (prev) { prev.value = String(ctx.previousBalance); prev.dataset.fuelAccounting = VERSION; prev.readOnly = true; }
    if (current) { current.value = String(ctx.currentBalance); current.dataset.fuelAccounting = VERSION; current.readOnly = true; }
    if (loss) { loss.value = '0'; loss.dataset.fuelAccounting = VERSION; }
  }

  function run() {
    patchSave();
    patchReportText();
    enforceForm().catch(console.warn);
  }
  run();
  window.addEventListener('DOMContentLoaded', run);
  window.addEventListener('load', run);
  document.addEventListener('input', e => {
    if (e.target?.matches?.('[name="fuelConsumed"], [name="reportDate"]')) setTimeout(() => enforceForm().catch(console.warn), 0);
  }, true);
  document.addEventListener('change', e => {
    if (e.target?.matches?.('[name="fuelConsumed"], [name="reportDate"]')) setTimeout(() => enforceForm().catch(console.warn), 0);
  }, true);
  new MutationObserver(() => {
    patchSave();
    patchReportText();
    if (document.getElementById('reportForm')) setTimeout(() => enforceForm().catch(console.warn), 30);
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.FuelAccountingUnified = { version: VERSION, contextFor, normalizeReport, normalizeReports, enforceForm };
})();
