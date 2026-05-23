(() => {
  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function severityOf(message) {
    const text = String(message || '');
    if (text.includes('أكبر من الإنتاج') || text.includes('رصيد الوقود')) return 'danger';
    if (text.includes('معدّل يدويًا') || text.includes('لا يطابق')) return 'medium';
    return 'soft';
  }

  function warningList(report) {
    const r = window.ReportUtils.recalc(report || {});
    return (r.warnings || []).map(message => ({ message, severity: severityOf(message) }));
  }

  function renderWarnings(report) {
    const list = warningList(report);
    if (!list.length) return '';
    const hasWater = list.some(w => w.message.includes('المياه المعبأة') || w.message.includes('الإنتاج'));
    const hasBeneficiaries = list.some(w => w.message.includes('الجهات'));
    return `<div class="smart-warnings">${list.map(w => `<div class="smart-warning ${w.severity}"><p>${esc(w.message)}</p></div>`).join('')}<div class="quick-warning-actions">${hasWater ? `<button class="btn primary" onclick="WarningActions.openWaterFix('${report.id}')">تعديل الإنتاج/المعبأ فقط</button>` : ''}${hasBeneficiaries ? `<button class="btn" onclick="WarningActions.openBeneficiaryFix('${report.id}')">تعديل الجهات الناقصة فقط</button>` : ''}</div></div>`;
  }

  function getReport(id) {
    return (window.__WATER_REPORTS_CACHE__ || []).find(item => item.id === id);
  }

  async function saveReportPatch(id, patcher) {
    const source = getReport(id);
    if (!source) return alert('تعذر العثور على التقرير. أعد تحميل الصفحة.');
    const next = patcher(structuredClone(source));
    next.warnings = window.ReportUtils.recalc(next).warnings;
    await window.FirebaseService.saveReport(next, window.firebase?.auth?.().currentUser || null, id);
  }

  function closeModal() {
    document.getElementById('quickFixModal')?.remove();
  }

  function openWaterFix(id) {
    const report = window.ReportUtils.recalc(getReport(id));
    if (!report) return;
    const modal = document.createElement('div');
    modal.id = 'quickFixModal';
    modal.className = 'modal open quick-fix-modal';
    modal.innerHTML = `<div class="modal-backdrop" onclick="WarningActions.closeModal()"></div><div class="modal-panel quick-fix-panel"><button class="close" onclick="WarningActions.closeModal()">×</button><div class="modal-title"><span>💧</span><div><h2>تعديل سريع للمياه</h2><p>عدّل الإنتاج اليومي أو المياه المعبأة فقط بدون فتح التقرير الكامل.</p></div></div><div class="quick-fix-grid"><label>الإنتاج اليومي / كوب<input id="quickDailyProduction" type="number" value="${esc(report.water?.dailyProduction || '')}"></label><label>المياه المعبأة / كوب<input id="quickFilledWater" type="number" value="${esc(report.water?.filledWater || '')}"></label><label>العادم / كوب<input id="quickRejectWater" type="number" value="${esc(report.water?.rejectWater || '')}"></label></div><div class="notice soft"><p>ملاحظة: إذا وضعت قيمة للمياه المعبأة هنا سيتم اعتمادها كقيمة يدوية بدل مجموع الجهات.</p></div><div class="actions modal-actions"><button class="btn primary big" onclick="WarningActions.saveWaterFix('${id}')">حفظ التعديل السريع</button><button class="btn" onclick="WarningActions.closeModal()">إلغاء</button></div></div>`;
    document.body.appendChild(modal);
  }

  async function saveWaterFix(id) {
    const daily = document.getElementById('quickDailyProduction')?.value || '';
    const filled = document.getElementById('quickFilledWater')?.value || '';
    const reject = document.getElementById('quickRejectWater')?.value || '';
    await saveReportPatch(id, report => {
      report.water = report.water || {};
      report.water.dailyProduction = daily;
      report.water.manualFilledWater = filled;
      report.water.filledWater = filled;
      report.water.rejectWater = reject;
      return report;
    });
    closeModal();
  }

  function openBeneficiaryFix(id) {
    const report = window.ReportUtils.recalc(getReport(id));
    if (!report) return;
    const rows = (report.beneficiaries || []).map((b, i) => {
      const missing = String(b.name || '').trim() && (!window.ReportUtils.number(b.quantity) || !window.ReportUtils.number(b.cars));
      return `<tr class="${missing ? 'needs-fix' : ''}"><td>${esc(b.name || '-')}</td><td><input data-q="${i}" type="number" value="${esc(b.quantity || '')}" placeholder="كوب"></td><td><input data-c="${i}" type="number" value="${esc(b.cars || '')}" placeholder="سيارة"></td></tr>`;
    }).join('');
    const modal = document.createElement('div');
    modal.id = 'quickFixModal';
    modal.className = 'modal open quick-fix-modal';
    modal.innerHTML = `<div class="modal-backdrop" onclick="WarningActions.closeModal()"></div><div class="modal-panel quick-fix-panel large"><button class="close" onclick="WarningActions.closeModal()">×</button><div class="modal-title"><span>🚚</span><div><h2>تعديل سريع للجهات</h2><p>أكمل الكمية وعدد السيارات للجهات الناقصة فقط.</p></div></div><div class="table-wrap"><table><thead><tr><th>الجهة</th><th>الكمية</th><th>السيارات</th></tr></thead><tbody>${rows}</tbody></table></div><div class="actions modal-actions"><button class="btn primary big" onclick="WarningActions.saveBeneficiaryFix('${id}')">حفظ الجهات</button><button class="btn" onclick="WarningActions.closeModal()">إلغاء</button></div></div>`;
    document.body.appendChild(modal);
  }

  async function saveBeneficiaryFix(id) {
    await saveReportPatch(id, report => {
      report.beneficiaries = (report.beneficiaries || []).map((b, i) => ({
        ...b,
        quantity: document.querySelector(`[data-q="${i}"]`)?.value || b.quantity || '',
        cars: document.querySelector(`[data-c="${i}"]`)?.value || b.cars || ''
      }));
      return report;
    });
    closeModal();
  }

  function patchDetails() {
    if (!window.AppUI || window.AppUI.__warningActionsPatched) return;
    const originalLayout = window.AppUI.layout;
    window.AppUI.layout = function patchedLayout(state, settings) {
      let html = originalLayout(state, settings);
      const reports = state?.reports || [];
      const active = reports.find(r => r.id === state.currentId);
      if (!active) return html;
      const oldWarning = html.match(/<div class="notice warn">[\s\S]*?<\/div>/);
      if (oldWarning) html = html.replace(oldWarning[0], renderWarnings(active));
      return html;
    };
    window.AppUI.__warningActionsPatched = true;
  }

  patchDetails();

  window.WarningActions = { renderWarnings, openWaterFix, saveWaterFix, openBeneficiaryFix, saveBeneficiaryFix, closeModal };
})();
