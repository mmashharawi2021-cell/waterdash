(() => {
  function patchFirebaseSaveDate() {
    if (!window.FirebaseService || window.FirebaseService.__dateNormalizePatched) return;
    const originalSave = window.FirebaseService.saveReport;
    window.FirebaseService.saveReport = function patchedSaveReport(report, user, existingId) {
      const normalized = window.ReportUtils?.recalc ? window.ReportUtils.recalc(report) : report;
      if (normalized?.reportDate && window.ReportUtils?.normalizeDateInput) {
        normalized.reportDate = window.ReportUtils.normalizeDateInput(normalized.reportDate);
      }
      return originalSave.call(window.FirebaseService, normalized, user, existingId);
    };
    window.FirebaseService.__dateNormalizePatched = true;
  }

  patchFirebaseSaveDate();
  window.addEventListener('DOMContentLoaded', patchFirebaseSaveDate);
})();
