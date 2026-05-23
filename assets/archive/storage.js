window.AppStore = (() => {
  const KEY = 'saleh_water_reports_v3';
  const DEFAULTS = { reports: [], currentId: null, user: 'صالح الدحنون' };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch (error) {
      return { ...DEFAULTS };
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify({ ...DEFAULTS, ...data }));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function upsertReport(report) {
    const data = load();
    const reports = Array.isArray(data.reports) ? data.reports : [];
    const index = reports.findIndex(item => item.date === report.date);
    const finalReport = { ...report, id: index >= 0 ? reports[index].id : uid(), updatedAt: new Date().toISOString() };
    if (index >= 0) reports[index] = finalReport;
    else reports.unshift(finalReport);
    save({ ...data, reports, currentId: finalReport.id });
    return finalReport;
  }

  function deleteReport(id) {
    const data = load();
    const reports = (data.reports || []).filter(item => item.id !== id);
    save({ ...data, reports, currentId: reports[0]?.id || null });
  }

  function clearReports() {
    save({ ...load(), reports: [], currentId: null });
  }

  function selectReport(id) {
    save({ ...load(), currentId: id });
  }

  return { load, save, uid, upsertReport, deleteReport, clearReports, selectReport };
})();
