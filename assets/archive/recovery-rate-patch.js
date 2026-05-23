(() => {
  'use strict';

  const LABELS = {
    totalInput: 'إجمالي المياه الداخلة',
    recovery: 'نسبة الاسترداد',
    reject: 'نسبة العادم'
  };

  function num(value) {
    if (window.ReportUtils?.number) return window.ReportUtils.number(value);
    const parsed = Number(String(value ?? '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function cleanNumber(value, digits = 2) {
    if (!Number.isFinite(value)) return '';
    const rounded = +value.toFixed(digits);
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  }

  function calcWaterRatios(report) {
    const r = report || {};
    r.water = r.water || {};

    const filteredRate = num(r.water.filteredRate);
    const submersibleRate = num(r.water.submersibleRate);
    const dailyProduction = num(r.water.dailyProduction);
    const rejectWater = num(r.water.rejectWater);

    const totalDaily = dailyProduction + rejectWater;
    const rejectRateHourly = submersibleRate && filteredRate ? Math.max(submersibleRate - filteredRate, 0) : 0;
    const totalRate = submersibleRate || (filteredRate + rejectRateHourly);

    if (totalDaily > 0) {
      r.water.totalInputWater = cleanNumber(totalDaily);
      r.water.recoveryRate = cleanNumber((dailyProduction / totalDaily) * 100);
      r.water.rejectRatePercentage = cleanNumber((rejectWater / totalDaily) * 100);
    } else if (totalRate > 0) {
      r.water.totalInputWater = '';
      r.water.recoveryRate = cleanNumber((filteredRate / totalRate) * 100);
      r.water.rejectRatePercentage = cleanNumber((rejectRateHourly / totalRate) * 100);
    }

    r.water.totalInputRate = totalRate ? cleanNumber(totalRate) : '';
    return r;
  }

  function patchReportUtils() {
    if (!window.ReportUtils || window.ReportUtils.__recoveryRatePatched) return;

    const originalRecalc = window.ReportUtils.recalc;
    const originalWhatsappText = window.ReportUtils.whatsappText;
    const originalSummary = window.ReportUtils.summary;

    window.ReportUtils.recalc = function recoveryRecalc(report) {
      return calcWaterRatios(originalRecalc.call(window.ReportUtils, report));
    };

    window.ReportUtils.summary = function recoverySummary(reports) {
      const summary = originalSummary.call(window.ReportUtils, reports || []);
      const list = (reports || []).map(item => window.ReportUtils.recalc(item));
      const totalProduction = list.reduce((sum, item) => sum + num(item.water?.dailyProduction), 0);
      const totalReject = list.reduce((sum, item) => sum + num(item.water?.rejectWater), 0);
      const totalInput = totalProduction + totalReject;
      summary.totalInputWater = cleanNumber(totalInput);
      summary.recoveryRate = totalInput ? +cleanNumber((totalProduction / totalInput) * 100) : 0;
      summary.rejectRatePercentage = totalInput ? +cleanNumber((totalReject / totalInput) * 100) : 0;
      return summary;
    };

    window.ReportUtils.whatsappText = function recoveryWhatsapp(report) {
      const r = window.ReportUtils.recalc(report);
      const text = originalWhatsappText.call(window.ReportUtils, r);
      const extra = [
        `▪️ ${LABELS.totalInput}: ${r.water.totalInputWater || '_'} كوب`,
        `▪️ ${LABELS.recovery}: ${r.water.recoveryRate || '_'}%`,
        `▪️ ${LABELS.reject}: ${r.water.rejectRatePercentage || '_'}%`
      ].join('\n');
      if (text.includes('▪️ نسبة الفاقد:')) {
        return text.replace(/(▪️ نسبة الفاقد:.*?%)/, `$1\n${extra}`);
      }
      return `${text}\n${extra}`;
    };

    window.ReportUtils.__recoveryRatePatched = true;
  }

  function patchAppUI() {
    if (!window.AppUI || window.AppUI.__recoveryRatePatched) return;

    const originalReportForm = window.AppUI.reportForm;
    const originalDetails = window.AppUI.details;
    const originalLayout = window.AppUI.layout;

    window.AppUI.reportForm = function recoveryReportForm(report, settings) {
      const r = window.ReportUtils.recalc(report || window.ReportUtils.emptyReport());
      let html = originalReportForm.call(window.AppUI, r, settings);
      if (!html.includes('name="recoveryRate"')) {
        html = html.replace(
          /<label>نسبة الفاقد %<input name="lossPercentage" type="number" value="([^"]*)"><\/label>/,
          `<label>نسبة الفاقد %<input name="lossPercentage" type="number" value="$1"></label><label>${LABELS.totalInput} بالكوب<input name="totalInputWater" type="number" value="${r.water.totalInputWater || ''}" readonly></label><label>${LABELS.recovery} %<input name="recoveryRate" type="number" value="${r.water.recoveryRate || ''}" readonly></label><label>${LABELS.reject} %<input name="rejectRatePercentage" type="number" value="${r.water.rejectRatePercentage || ''}" readonly></label>`
        );
      }
      return html;
    };

    window.AppUI.details = function recoveryDetails(report) {
      if (!report) return originalDetails.call(window.AppUI, report);
      const r = window.ReportUtils.recalc(report);
      let html = originalDetails.call(window.AppUI, r);
      if (!html.includes(`<span>${LABELS.recovery}</span>`)) {
        html = html.replace(
          /<article><span>نسبة الفاقد<\/span><strong>.*?<\/strong><\/article>/,
          match => `${match}<article><span>${LABELS.totalInput}</span><strong>${r.water.totalInputWater || 0} كوب</strong></article><article><span>${LABELS.recovery}</span><strong>${r.water.recoveryRate || 0}%</strong></article><article><span>${LABELS.reject}</span><strong>${r.water.rejectRatePercentage || 0}%</strong></article>`
        );
      }
      return html;
    };

    window.AppUI.layout = function recoveryLayout(state, settings) {
      const html = originalLayout.call(window.AppUI, state, settings);
      const reports = state?.reports || [];
      const s = window.ReportUtils.summary(reports);
      const recoveryKpi = `<article class="kpi-card recovery-kpi"><div class="kpi-icon">♻️</div><span>${LABELS.recovery}</span><strong>${s.recoveryRate || 0}%</strong><small>الصافي من الإجمالي الداخل</small></article>`;
      if (html.includes('recovery-kpi')) return html;
      return html.replace(/(<article class="kpi-card"><div class="kpi-icon">🧪<\/div>)/, `${recoveryKpi}$1`);
    };

    window.AppUI.__recoveryRatePatched = true;
  }

  function patchLiveCalculations() {
    if (window.LiveCalculations?.__recoveryRatePatched) return;

    function updateCurrentForm() {
      const form = document.getElementById('reportForm');
      if (!form) return;
      const dailyProduction = num(form.querySelector('[name="dailyProduction"]')?.value);
      const rejectWater = num(form.querySelector('[name="rejectWater"]')?.value);
      const total = dailyProduction + rejectWater;
      const totalInput = form.querySelector('[name="totalInputWater"]');
      const recovery = form.querySelector('[name="recoveryRate"]');
      const reject = form.querySelector('[name="rejectRatePercentage"]');
      if (totalInput) totalInput.value = total ? cleanNumber(total) : '';
      if (recovery) recovery.value = total ? cleanNumber((dailyProduction / total) * 100) : '';
      if (reject) reject.value = total ? cleanNumber((rejectWater / total) * 100) : '';
    }

    const originalRunAll = window.LiveCalculations?.runAll;
    if (originalRunAll) {
      window.LiveCalculations.runAll = function patchedRunAll(form, changedName) {
        const result = originalRunAll.call(window.LiveCalculations, form, changedName);
        updateCurrentForm();
        return result;
      };
    }

    document.addEventListener('input', updateCurrentForm, true);
    document.addEventListener('change', updateCurrentForm, true);
    setTimeout(updateCurrentForm, 300);
    window.LiveCalculations = window.LiveCalculations || {};
    window.LiveCalculations.__recoveryRatePatched = true;
  }

  function patchExportCenter() {
    if (!window.ExportCenter || window.ExportCenter.__recoveryRatePatched) return;
    // The unified export center builds rows internally. This lightweight patch keeps the
    // official calculations available on every report through ReportUtils.recalc.
    // Future export-center cleanup can add the three columns directly in its row mapper.
    window.ExportCenter.__recoveryRatePatched = true;
  }

  function boot() {
    patchReportUtils();
    patchAppUI();
    patchLiveCalculations();
    patchExportCenter();
  }

  window.RecoveryRatePatch = { boot, calcWaterRatios };
  window.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', boot);
  setTimeout(boot, 200);
  setTimeout(boot, 1000);
  boot();
})();
