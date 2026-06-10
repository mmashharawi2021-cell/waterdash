/* --- Auto-Generated Module: ui-system.js --- */

/* ==========================================
   FILE: skip-warnings-patch.js
   ========================================== */
(() => {
  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function getReport(id) {
    return (window.__WATER_REPORTS_CACHE__ || []).find(item => item.id === id);
  }

  function normalizeSkipped(report) {
    return Array.isArray(report?.skippedWarnings) ? report.skippedWarnings : [];
  }

  function isSkipped(report, message) {
    return normalizeSkipped(report).includes(message);
  }

  function visibleWarnings(report) {
    const base = window.ReportUtils?.recalc ? window.ReportUtils.recalc({ ...report, skippedWarnings: [] }) : report;
    const skipped = normalizeSkipped(report);
    return (base.warnings || []).filter(message => !skipped.includes(message));
  }

  function severityOf(message) {
    const text = String(message || '');
    if (text.includes('أكبر من الإنتاج') || text.includes('رصيد الوقود')) return 'danger';
    if (text.includes('معدّل يدويًا') || text.includes('لا يطابق')) return 'medium';
    return 'soft';
  }

  function renderWarnings(report) {
    const list = visibleWarnings(report);
    if (!list.length) return '';
    return `<div class="smart-warnings skip-enabled-warnings">${list.map(message => {
      const severity = severityOf(message);
      const isWater = message.includes('المياه المعبأة') || message.includes('الإنتاج');
      const isBeneficiaries = message.includes('الجهات');
      return `<div class="smart-warning ${severity}"><p>${esc(message)}</p><div class="single-warning-actions">${isWater ? `<button class="btn primary" onclick="WarningSkipActions.openWaterFix('${report.id}')">تعديل سريع</button>` : ''}${isBeneficiaries ? `<button class="btn" onclick="WarningSkipActions.openBeneficiaryFix('${report.id}')">تعديل الجهات</button>` : ''}<button class="btn ghost skip-warning-btn" onclick="WarningSkipActions.skip('${report.id}', '${esc(message).replace(/'/g, '&#039;')}')">تخطي هذا التنبيه</button></div></div>`;
    }).join('')}</div>`;
  }

  async function skip(id, message) {
    const report = getReport(id);
    if (!report) return alert('تعذر العثور على التقرير. أعد تحميل الصفحة.');
    const text = String(message || '').replace(/&#039;/g, "'");
    const skipped = [...new Set([...normalizeSkipped(report), text])];
    const next = { ...report, skippedWarnings: skipped };
    if (window.ReportUtils?.recalc) next.warnings = window.ReportUtils.recalc(next).warnings;
    await window.FirebaseService.saveReport(next, window.firebase?.auth?.().currentUser || null, id);
  }

  async function unskipAll(id) {
    const report = getReport(id);
    if (!report) return;
    const next = { ...report, skippedWarnings: [] };
    if (window.ReportUtils?.recalc) next.warnings = window.ReportUtils.recalc(next).warnings;
    await window.FirebaseService.saveReport(next, window.firebase?.auth?.().currentUser || null, id);
  }

  function patchReportUtils() {
    if (!window.ReportUtils || window.ReportUtils.__skipWarningsPatched) return;
    const originalRecalc = window.ReportUtils.recalc;
    window.ReportUtils.recalc = function patchedRecalc(report) {
      const r = originalRecalc(report);
      const skipped = normalizeSkipped(report || r);
      r.skippedWarnings = skipped;
      if (Array.isArray(r.warnings) && skipped.length) {
        r.warnings = r.warnings.filter(message => !skipped.includes(message));
      }
      return r;
    };
    window.ReportUtils.__skipWarningsPatched = true;
  }

  function patchLayout() {
    if (!window.AppUI || window.AppUI.__skipWarningsLayoutPatched) return;
    const previousLayout = window.AppUI.layout;
    window.AppUI.layout = function patchedSkipWarningsLayout(state, settings) {
      const reports = state?.reports || [];
      const active = reports.find(r => r.id === state.currentId) || null;
      let html = previousLayout(state, settings);
      if (!active) return html;
      const replacement = renderWarnings(active);
      if (html.includes('smart-warnings')) {
        html = html.replace(/<div class="smart-warnings[\s\S]*?<\/div>\s*<\/div>/, replacement);
      } else if (replacement) {
        html = html.replace('<div class="detail-grid">', `${replacement}<div class="detail-grid">`);
      }
      const skippedCount = normalizeSkipped(active).length;
      if (skippedCount && html.includes('<div class="detail-grid">')) {
        const restore = `<div class="skipped-warning-note"><span>تم تخطي ${skippedCount} تنبيه في هذا التقرير.</span><button class="btn ghost" onclick="WarningSkipActions.unskipAll('${active.id}')">إظهار التنبيهات المخفية</button></div>`;
        html = html.replace('<div class="detail-grid">', `${restore}<div class="detail-grid">`);
      }
      return html;
    };
    window.AppUI.__skipWarningsLayoutPatched = true;
  }

  function patchAll() {
    patchReportUtils();
    patchLayout();
  }

  window.WarningSkipActions = {
    skip,
    unskipAll,
    visibleWarnings,
    renderWarnings,
    openWaterFix: id => window.WarningActions?.openWaterFix?.(id),
    openBeneficiaryFix: id => window.WarningActions?.openBeneficiaryFix?.(id)
  };

  patchAll();
  window.addEventListener('DOMContentLoaded', patchAll);
})();


/* ==========================================
   FILE: date-save-patch.js
   ========================================== */
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


/* ==========================================
   FILE: ui.js
   ========================================== */
window.AppUI = (() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const d = v => window.ReportUtils.displayDate(v);

  function login(configured) {
    return `<main class="login-screen premium-login"><section class="login-visual"><div class="orb orb-a"></div><div class="orb orb-b"></div><div class="well-mark">💧</div><p class="eyebrow">منصة تشغيل رسمية</p><h1>نظام تقارير تشغيل وضخ المياه</h1></section><section class="login-card"><p class="eyebrow">تسجيل الدخول</p><h2>مرحبًا بك</h2><p class="muted">أدخل بيانات الدخول المعتمدة للمتابعة.</p>${!configured ? `<div class="notice warn"><p>Firebase غير مفعّل بعد. عدّل ملف assets/firebase-config.js ببيانات مشروعك.</p></div>` : ''}<form onsubmit="App.login(event)" class="login-form"><label>اسم المستخدم</label><input id="loginUsername" type="text" required autocomplete="username" placeholder="أدخل اسم المستخدم"><label>كلمة المرور</label><input id="loginPassword" type="password" required autocomplete="current-password" placeholder="أدخل كلمة المرور"><button class="btn primary big action-float" type="submit">دخول للنظام</button></form></section></main>`;
  }

  function skeleton() {
    return `<div class="dashboard-layout">
      <aside class="app-sidebar" style="pointer-events:none;">
        <div class="sidebar-brand" style="opacity:0.5"><div class="skeleton-card" style="width:48px;height:48px;border-radius:12px;min-height:0"></div><div style="flex:1"><div class="sk sk-title" style="height:20px;margin:0"></div></div></div>
        <div class="sidebar-user" style="opacity:0.5;border:none;background:transparent"><div class="skeleton-card" style="width:40px;height:40px;border-radius:50%;min-height:0"></div><div style="flex:1"><div class="sk sk-line" style="height:14px;margin:0"></div></div></div>
        <nav class="sidebar-nav" style="opacity:0.5;gap:12px">
          <div class="skeleton-card" style="height:45px;border-radius:12px;min-height:0"></div>
          <div class="skeleton-card" style="height:45px;border-radius:12px;min-height:0"></div>
          <div class="skeleton-card" style="height:45px;border-radius:12px;min-height:0"></div>
        </nav>
      </aside>
      <main class="dashboard-main" style="pointer-events:none;">
        <header class="top-header" style="opacity:0.5">
          <div class="skeleton-card" style="width:300px;height:44px;border-radius:30px;min-height:0"></div>
          <div class="skeleton-card" style="width:120px;height:40px;border-radius:30px;min-height:0"></div>
        </header>
        <div class="dashboard-content">
          <section class="stats-grid">
            <article class="skeleton-card" style="border-radius:20px;min-height:110px"></article>
            <article class="skeleton-card" style="border-radius:20px;min-height:110px"></article>
            <article class="skeleton-card" style="border-radius:20px;min-height:110px"></article>
            <article class="skeleton-card" style="border-radius:20px;min-height:110px"></article>
          </section>
          <div class="dashboard-split">
            <section class="skeleton-card" style="border-radius:24px;height:60vh;border:none"></section>
            <section class="skeleton-card" style="border-radius:24px;height:60vh;border:none"></section>
          </div>
        </div>
      </main>
    </div>`;
  }

  function card(report, activeId) {
    const r = window.ReportUtils.recalc(report);
    const warningBadge = r.warnings?.length ? `<b class="card-badge warn">${r.warnings.length} تنبيه</b>` : `<b class="card-badge ok">مكتمل</b>`;
    return `<button class="report-card ${r.id === activeId ? 'active' : ''}" onclick="App.select('${r.id}')"><span>${d(r.reportDate)} ${warningBadge}</span><strong>${esc(r.title)}</strong><small>${r.stationName || '-'} • تشغيل ${r.generator.totalRunHours || '-'} • وقود ${r.fuel.consumedDaily || 0} لتر</small><em>${r.water.filledWater || 0} كوب معبأ • ${r.water.carsCount || 0} سيارة</em></button>`;
  }

  function kpi(icon, label, value, hint = '') {
    return `<article class="kpi-card"><div class="kpi-icon">${icon}</div><span>${label}</span><strong>${value}</strong>${hint ? `<small>${hint}</small>` : ''}</article>`;
  }

  function beneficiariesList(report) {
    const rows = (report.beneficiaries || []).map(item => `<article><strong>${esc(item.name || '-')}</strong><span>${item.quantity || 0} كوب</span><span>${item.cars || 0} سيارة</span></article>`).join('');
    return `<section class="beneficiary-summary"><div class="section-head mini-head"><div><p class="eyebrow">الجهات المستفيدة</p><h3>ملخص التعبئة</h3></div></div><div class="beneficiary-cards">${rows || '<div class="empty-mini">لا توجد جهات مستفيدة.</div>'}</div></section>`;
  }

  function testsSummary(report) {
    const t = report.tests || {};
    return `<section class="tests-summary"><div class="section-head mini-head"><div><p class="eyebrow">فحوصات المياه</p><h3>قراءات اليوم</h3></div></div><div class="test-cards"><article><span>PH بعد التحلية</span><strong>${t.phAfterDesalination || '_'}</strong></article><article><span>PH الغاطس</span><strong>${t.phWellWater || '_'}</strong></article><article><span>TDS محلاة</span><strong>${t.tdsDesalinated || '_'}</strong></article><article><span>TDS بئر</span><strong>${t.tdsWell || '_'}</strong></article><article><span>TDS عادم</span><strong>${t.tdsReject || '_'}</strong></article><article><span>الكلور الحر</span><strong>${t.freeChlorine || '_'}</strong></article></div></section>`;
  }

  function details(report) {
    if (!report) return `<section id="reportDetails" class="details empty-state details-placeholder"><div class="empty-icon">📄</div><h2>اختر تقريرًا من الكروت</h2><p>عند الضغط على أي كرت ستظهر تفاصيله هنا بحركة سلسة.</p></section>`;
    const r = window.ReportUtils.recalc(report);
    const warnings = r.warnings?.length ? `<div class="notice warn">${r.warnings.map(w => `<p>${esc(w)}</p>`).join('')}</div>` : '';
    return `<section id="reportDetails" class="details details-reveal"><div class="section-head details-title"><div><p class="eyebrow">تفاصيل التقرير</p><h2>${esc(r.title)}</h2></div></div>${warnings}<div class="detail-grid"><article><span>التاريخ</span><strong>${d(r.reportDate)}</strong></article><article><span>المحطة</span><strong>${esc(r.stationName)}</strong></article><article><span>ساعات التشغيل</span><strong>${r.generator.totalRunHours || '-'}</strong></article><article><span>الوقود المستهلك</span><strong>${r.fuel.consumedDaily || 0} لتر</strong></article><article><span>الإنتاج اليومي</span><strong>${r.water.dailyProduction || 0} كوب</strong></article><article><span>العادم</span><strong>${r.water.rejectWater || 0} كوب</strong></article><article><span>إجمالي المياه الداخلة</span><strong>${r.water.totalInputWater || 0} كوب</strong></article><article><span>نسبة الاسترداد</span><strong>${r.water.recoveryRate || 0}%</strong></article><article><span>نسبة العادم</span><strong>${r.water.rejectRatePercentage || 0}%</strong></article><article><span>المعبأ</span><strong>${r.water.filledWater || 0} كوب</strong></article><article><span>السيارات</span><strong>${r.water.carsCount || 0}</strong></article><article><span>نسبة الفاقد</span><strong>${r.water.lossPercentage || 0}%</strong></article></div>${testsSummary(r)}${beneficiariesList(r)}<details class="official-report"><summary>عرض النص الرسمي للتقرير</summary><div class="report-preview">${esc(window.ReportUtils.whatsappText(r))}</div></details><div class="report-actions-panel"><button class="btn primary action-float" onclick="App.openEdit('${r.id}')">✏️ تعديل التقرير</button><button class="btn action-float" onclick="App.copyWhatsApp('${r.id}')">🟢 إرسال واتساب</button><button class="btn action-float" onclick="App.exportPdf('${r.id}')">📄 تصدير PDF</button><button class="btn action-float" onclick="App.exportOneExcel('${r.id}')">📊 تصدير Excel</button><button class="btn danger" onclick="App.deleteReport('${r.id}')">🗑️ حذف التقرير</button></div></section>`;
  }

  function reportForm(state, settings = {}) {
    const r = (state && (state.draft || (state.generator || state.reportDate ? state : null))) || window.ReportUtils.recalc(window.ReportUtils.emptyReport());
    const step = state.formStep || window.App?.state?.formStep || 1;
    const editingId = state.editingId || window.App?.state?.editingId || null;
    const templates = settings.beneficiaries || [];
    const templateChips = templates.map(name => `<button class="template-chip" type="button" onclick="App.addBeneficiaryTemplate('${esc(name).replace(/'/g, '&#039;')}')">+ ${esc(name)}</button>`).join('');
    const bRows = (r.beneficiaries || []).map((b, i) => `<tr><td><input data-b="name" data-i="${i}" value="${esc(b.name)}" list="beneficiaryTemplateList"></td><td><input data-b="quantity" data-i="${i}" type="number" value="${b.quantity || ''}" placeholder="كوب"></td><td><input data-b="cars" data-i="${i}" type="number" value="${b.cars || ''}" placeholder="سيارة"></td><td><input data-b="notes" data-i="${i}" value="${esc(b.notes || '')}"></td><td><button class="mini danger" onclick="App.removeBeneficiary(${i})" type="button">حذف</button></td></tr>`).join('');
    
    return `<div class="wizard-container">
      <div class="wizard-header">
        <div class="wizard-title">
          <span>📋</span>
          <div>
            <h2>${editingId ? 'تعديل التقرير' : 'إضافة تقرير جديد'}</h2>
            <p>الرجاء تعبئة بيانات التقرير بالخطوات التالية.</p>
          </div>
        </div>
        <div class="auto-box" style="margin-top: 16px;">
          <button class="btn primary action-float" onclick="App.togglePaste()">تعبئة تلقائية من نص التقرير</button>
          <textarea id="pasteText" class="smart-input hidden" placeholder="الصق تقرير واتساب الكامل هنا..."></textarea>
          <div class="actions"><button id="parseBtn" class="btn hidden" onclick="App.parseText()">تحليل النص وملء الحقول</button></div>
        </div>
      </div>
      
      <div class="wizard-stepper">
        <div class="step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}" onclick="App.setStep(1)"><span>1</span><b>بيانات عامة</b></div>
        <div class="step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}" onclick="App.setStep(2)"><span>2</span><b>المولد</b></div>
        <div class="step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}" onclick="App.setStep(3)"><span>3</span><b>المياه</b></div>
        <div class="step ${step >= 4 ? 'active' : ''} ${step > 4 ? 'completed' : ''}" onclick="App.setStep(4)"><span>4</span><b>الفحوصات والجهات</b></div>
        <div class="step ${step >= 5 ? 'active' : ''}" onclick="App.setStep(5)"><span>5</span><b>المعاينة</b></div>
      </div>

      <datalist id="beneficiaryTemplateList">${templates.map(name => `<option value="${esc(name)}"></option>`).join('')}</datalist>
      <form id="reportForm" class="form-grid wizard-form">
        <section class="wizard-panel" style="display: ${step === 1 ? 'grid' : 'none'};">
          <label>عنوان التقرير<input name="title" value="${esc(r.title)}"></label>
          <label>تاريخ التقرير<input name="reportDate" type="date" value="${r.reportDate || ''}"></label>
          <label>المحطة<input name="stationName" value="${esc(r.stationName || '')}"></label>
          <label>اسم البئر<input name="wellName" value="${esc(r.wellName || '')}"></label>
          <label>اسم المشغل<input name="operatorName" value="${esc(r.operatorName || '')}"></label>
          <label class="wide">ملاحظات عامة<textarea name="generalNotes">${esc(r.generalNotes || '')}</textarea></label>
        </section>
        
        <section class="wizard-panel" style="display: ${step === 2 ? 'grid' : 'none'};">
          <label>وقت التشغيل<input name="generatorStart" type="time" value="${r.generator.periods?.[0]?.startTime || ''}"></label>
          <label>وقت الإيقاف<input name="generatorEnd" type="time" value="${r.generator.periods?.[0]?.stopTime || ''}"></label>
          <label>ساعات التشغيل<input name="totalRunHours" value="${r.generator.totalRunHours || ''}"></label>
          <label>حالة المولد<input name="generatorStatus" value="${esc(r.generator.status || '')}"></label>
          <label>مشغل المولد<input name="generatorOperator" value="${esc(r.generator.operatorName || '')}"></label>
          <label class="wide">ملاحظات المولد<textarea name="generatorNotes">${esc(r.generator.notes || '')}</textarea></label>
        </section>
        
        <!-- Step 3: Fuel (removed, kept as hidden section for backward compatibility) -->
        <section class="wizard-panel" style="display: none;"></section>
        
        <section class="wizard-panel" style="display: ${step === 3 ? 'grid' : 'none'};">
          <label>إنتاج الغاطس كوب/ساعة<input name="submersibleRate" type="number" value="${r.water.submersibleRate || ''}"></label>
          <label>بعد الفلترة كوب/ساعة<input name="filteredRate" type="number" value="${r.water.filteredRate || ''}"></label>
          <label>الإنتاج اليومي بالكوب<input name="dailyProduction" type="number" value="${r.water.dailyProduction || ''}"></label>
          <label>العادم/الفاقد بالكوب<input name="rejectWater" type="number" value="${r.water.rejectWater || ''}"></label>
          <label>إجمالي المياه الداخلة<input name="totalInputWater" type="number" value="${r.water.totalInputWater || ''}" readonly></label>
          <label>نسبة الاسترداد %<input name="recoveryRate" type="number" value="${r.water.recoveryRate || ''}" readonly></label>
          <label>نسبة العادم %<input name="rejectRatePercentage" type="number" value="${r.water.rejectRatePercentage || ''}" readonly></label>
          <label>نسبة الفاقد %<input name="lossPercentage" type="number" value="${r.water.lossPercentage || ''}"></label>
          <label>المعبأ للجهات<input name="filledWater" type="number" value="${r.water.filledWater || ''}" readonly></label>
          <label>عدد السيارات<input name="carsCount" type="number" value="${r.water.carsCount || ''}" readonly></label>
          <label class="wide">ملاحظات المياه<textarea name="waterNotes">${esc(r.water.notes || '')}</textarea></label>
        </section>
        
        <section class="wizard-panel wide" style="display: ${step === 4 ? 'block' : 'none'};">
          <div class="tests-section" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;">
            <label>PH بعد التحلية<input name="phAfter" value="${r.tests.phAfterDesalination || ''}"></label>
            <label>PH مياه الغاطس<input name="phWell" value="${r.tests.phWellWater || ''}"></label>
            <label>TDS مياه محلاة<input name="tdsFiltered" value="${r.tests.tdsDesalinated || ''}"></label>
            <label>TDS بئر<input name="tdsWell" value="${r.tests.tdsWell || ''}"></label>
            <label>TDS عادم<input name="tdsReject" value="${r.tests.tdsReject || ''}"></label>
            <label>الكلور الحر<input name="freeChlorine" value="${r.tests.freeChlorine || ''}"></label>
          </div>
          <div class="template-panel">
            <strong>قوالب الجهات المستفيدة</strong>
            <div class="template-actions">
              <button class="btn action-float" type="button" onclick="App.applyBeneficiaryTemplates()">تعبئة الجهات الافتراضية</button>
              <button class="btn" type="button" onclick="App.clearBeneficiaryAmounts()">تفريغ الكميات فقط</button>
            </div>
            <div class="template-chips">${templateChips}</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>الجهة</th><th>الكمية</th><th>السيارات</th><th>ملاحظات</th><th></th></tr></thead>
              <tbody id="beneficiariesRows">${bRows || '<tr><td colspan="5">لا توجد جهات بعد.</td></tr>'}</tbody>
            </table>
          </div>
          <button class="btn action-float" type="button" onclick="App.addBeneficiary()" style="margin-top: 16px;">إضافة جهة</button>
        </section>
        
        <section class="wizard-panel wide" style="display: ${step === 5 ? 'block' : 'none'};">
          <div class="report-preview">${esc(window.ReportUtils.whatsappText(r))}</div>
        </section>
      </form>
      
      <div class="wizard-actions">
        ${step > 1 ? `<button class="btn" onclick="App.prevStep()">السابق</button>` : `<button class="btn" onclick="App.closeModal()">إلغاء</button>`}
        <div style="flex: 1;"></div>
        ${step < 5 ? `<button class="btn primary" onclick="App.nextStep()">التالي</button>` : `<button class="btn primary big action-float" onclick="App.saveReport()">حفظ التقرير</button>`}
      </div>
    </div>`;
  }


  function settingsModal(settings = {}) {
    return `<div id="settingsModal" class="modal"><div class="modal-backdrop" onclick="App.closeSettings()"></div><div class="modal-panel settings-panel" style="max-width: 800px;"><button class="close" onclick="App.closeSettings()">×</button><div class="modal-title"><span>⚙️</span><div><h2>الإعدادات الذكية</h2><p>الكروت المرجعية للحقول الثابتة في المحطة</p></div></div><form id="settingsForm" class="form-grid settings-form">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <article class="setting-card" style="background: var(--bg-card); padding: 16px; border-radius: 16px; border: 1px solid var(--border-color);">
          <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
            <div style="font-size: 24px;">💧</div>
            <div><h3 style="margin: 0; font-size: 15px;">المياه الحلوة</h3><small style="color: var(--text-muted); font-size: 11px;">الإنتاج في الساعة</small></div>
          </div>
          <input name="filteredRate" type="number" placeholder="مثال: 33" value="${settings.filteredRate || ''}" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main);">
        </article>
        <article class="setting-card" style="background: var(--bg-card); padding: 16px; border-radius: 16px; border: 1px solid var(--border-color);">
          <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
            <div style="font-size: 24px;">♻️</div>
            <div><h3 style="margin: 0; font-size: 15px;">نسبة الفاقد / العادم</h3><small style="color: var(--text-muted); font-size: 11px;">كنسبة مئوية %</small></div>
          </div>
          <input name="lossPercentage" type="number" step="0.01" placeholder="مثال: 32.74" value="${settings.lossPercentage !== undefined ? settings.lossPercentage : '32.74'}" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main);">
        </article>
        <article class="setting-card" style="background: var(--bg-card); padding: 16px; border-radius: 16px; border: 1px solid var(--border-color);">
          <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
            <div style="font-size: 24px;">⛽</div>
            <div><h3 style="margin: 0; font-size: 15px;">استهلاك الوقود</h3><small style="color: var(--text-muted); font-size: 11px;">لتر في الساعة</small></div>
          </div>
          <input name="fuelRate" type="number" placeholder="مثال: 19" value="${settings.fuelRate || '19'}" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main);">
        </article>
        <article class="setting-card" style="background: var(--bg-card); padding: 16px; border-radius: 16px; border: 1px solid var(--border-color);">
          <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
            <div style="font-size: 24px;">🚚</div>
            <div><h3 style="margin: 0; font-size: 15px;">سعة السيارة</h3><small style="color: var(--text-muted); font-size: 11px;">متوسط الأكواب للسيارة</small></div>
          </div>
          <input name="carCapacity" type="number" placeholder="مثال: 11.5" value="${settings.carCapacity || ''}" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main);">
        </article>
        <article class="setting-card" style="background: var(--bg-card); padding: 16px; border-radius: 16px; border: 1px solid var(--border-color);">
          <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
            <div style="font-size: 24px;">🚰</div>
            <div><h3 style="margin: 0; font-size: 15px;">إنتاج الغاطس</h3><small style="color: var(--text-muted); font-size: 11px;">للمراقبة والمقارنة</small></div>
          </div>
          <input name="submersibleRate" type="number" placeholder="مثال: 55" value="${settings.submersibleRate || ''}" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main);">
        </article>
        <article class="setting-card" style="background: var(--bg-card); padding: 16px; border-radius: 16px; border: 1px solid var(--border-color);">
          <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
            <div style="font-size: 24px;">🧪</div>
            <div><h3 style="margin: 0; font-size: 15px;">فحوصات افتراضية</h3><small style="color: var(--text-muted); font-size: 11px;">TDS أو غيرها</small></div>
          </div>
          <input name="defaultTests" type="text" placeholder="مثال: TDS:110" value="${esc(settings.defaultTests || '')}" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main);">
        </article>
      </div>
      <section class="wide settings-grid" style="border-top: 1px solid var(--border-color); padding-top: 24px; gap: 12px;">
        <h3 style="margin-bottom: 0px; font-size: 16px; grid-column: 1 / -1;">إعدادات نصوص التقرير</h3>
        <label>اسم المحطة الافتراضي<input name="defaultStationName" value="${esc(settings.defaultStationName || '')}"></label>
        <label>اسم البئر الافتراضي<input name="defaultWellName" value="${esc(settings.defaultWellName || '')}"></label>
        <label>اسم المشغل الافتراضي<input name="defaultOperatorName" value="${esc(settings.defaultOperatorName || '')}"></label>
        <label>حالة المولد الافتراضية<input name="defaultGeneratorStatus" value="${esc(settings.defaultGeneratorStatus || 'يعمل')}"></label>
        <label class="wide">قوالب الجهات المستفيدة <small>اكتب كل جهة في سطر مستقل</small><textarea name="beneficiaries" rows="4">${esc((settings.beneficiaries || []).join('\n'))}</textarea></label>
      </section>
      
      <section class="wide settings-grid" style="border-top: 1px solid var(--border-color); padding-top: 24px; gap: 12px; margin-top: 16px;">
        <h3 style="margin-bottom: 8px; font-size: 16px; grid-column: 1 / -1;">نطاق تطبيق القيم الثابتة</h3>
        <div style="display: flex; flex-direction: column; gap: 12px; grid-column: 1 / -1; background: var(--bg-card); padding: 16px; border-radius: 8px; border: 1px solid var(--border-color);">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex-direction: row; font-weight: normal;">
            <input type="radio" name="applyScope" value="future" checked style="width: auto; margin: 0;">
            تطبيق التعديلات على <strong>التقارير المستقبلية فقط</strong> (الخيار الآمن والافتراضي).
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex-direction: row; font-weight: normal;">
            <input type="radio" name="applyScope" value="past_no_fuel" style="width: auto; margin: 0;">
            تطبيق على <strong>جميع التقارير السابقة والمستقبلية</strong> (لتحديث كميات المياه والفاقد فقط دون تغيير أرصدة الوقود التراكمية).
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex-direction: row; font-weight: normal; color: #d32f2f;">
            <input type="radio" name="applyScope" value="past_with_fuel" style="width: auto; margin: 0;">
            تطبيق شامل على <strong>التقارير السابقة والمستقبلية + إعادة بناء أرصدة الوقود التراكمية</strong> (انتباه: سيغير رصيد الوقود الحالي!).
          </label>
        </div>
      </section>
    </form><div class="actions modal-actions" style="margin-top: 24px;"><button class="btn primary big action-float" onclick="App.saveSettings()">حفظ الإعدادات</button><button class="btn" onclick="App.resetSettings()">استرجاع الافتراضي</button><button class="btn" onclick="App.closeSettings()">إغلاق</button></div></div></div>`;
  }

  function bottomNav() {
    return `<nav class="bottom-nav"><button onclick="App.goHome()"><span>🏠</span><b>الرئيسية</b></button><button onclick="App.goReports()"><span>📋</span><b>التقارير</b></button><button class="main" onclick="App.openNew()"><span>＋</span><b>إضافة</b></button><button onclick="App.openSettings()"><span>⚙️</span><b>الإعدادات</b></button></nav>`;
  }

  function layout(state, settings = {}) {
    const reports = state.reports || [];
    const active = reports.find(r => r.id === state.currentId) || null;
    const s = window.ReportUtils.summary(reports);
    return `<main class="app-shell"><header id="top" class="hero"><div><p class="eyebrow">لوحة التشغيل</p><h1>نظام تقارير تشغيل وضخ المياه</h1><p>منصة يومية رسمية للتشغيل، الوقود، الإنتاج، الفحوصات، الجهات المستفيدة، والأرشفة.</p></div><div class="hero-actions"><button class="btn primary big action-float" onclick="App.openNew()">➕ إضافة تقرير جديد</button><button class="btn action-float" onclick="App.duplicateLastReport()">⧉ تكرار آخر تقرير</button><button class="btn" onclick="App.openSummary()">📈 تقارير تجميعية</button><button class="btn" onclick="App.exportAllExcel()">📊 Excel شامل</button><button class="btn" onclick="App.openSettings()">⚙️ الإعدادات</button><button class="btn ghost" onclick="App.logout()">🚪 خروج</button></div></header><section class="stats dashboard-totals"><article class="kpi-wide"><div class="kpi-head"><span>ملخص التشغيل</span><b>${reports.length} تقرير</b></div><strong>${s.runHours.toFixed(1)}</strong><small>إجمالي ساعات التشغيل</small></article>${kpi('⛽','وقود مستهلك',s.fuelConsumed,'لتر')}${kpi('💧','مياه معبأة',s.filledWater,'كوب')}${kpi('🚚','عدد السيارات',s.cars,'سيارة')}${kpi('🏭','إجمالي الإنتاج',s.waterProduction,'كوب')}${kpi('🌊','إجمالي المياه الداخلة',s.totalInputWater || 0,'كوب')}${kpi('♻️','نسبة الاسترداد',`${s.recoveryRate || 0}%`,'الصافي من الإجمالي الداخل')}${kpi('🔁','نسبة العادم',`${s.rejectRatePercentage || 0}%`,'العادم من الإجمالي الداخل')}${kpi('📉','نسبة الفاقد',`${s.lossPercentage}%`,'محسوبة تلقائيًا')}${kpi('🧪','فحوصات',reports.length,'سجل يومي')}</section><section id="reports" class="cards-section"><div class="section-head"><div><p class="eyebrow">الأرشيف</p><h2>كروت التقارير</h2></div></div><div class="cards reports-grid">${reports.map(r => card(r, active?.id)).join('') || '<div class="empty-mini">لا توجد تقارير محفوظة.</div>'}</div></section>${details(active)}<div class="bottom-space"></div>${modal()}${settingsModal(settings)}${bottomNav()}</main>`;
  }

  return { login, skeleton, layout, reportForm, settingsModal, esc };
})();


/* ==========================================
   FILE: startup-stability-fix.js
   ========================================== */
(() => {
  function patchListenReports() {
    if (!window.FirebaseService || window.FirebaseService.__startupStabilityPatched) return;

    window.FirebaseService.listenReports = function stableListenReports(callback) {
      window.FirebaseService.init?.();
      const db = firebase.firestore();
      let delivered = false;
      let unsubscribe = () => {};

      const fallback = setTimeout(() => {
        if (delivered) return;
        delivered = true;
        console.warn('Reports snapshot delayed. Rendering fallback dashboard.');
        callback(window.__WATER_REPORTS_CACHE__ || []);
      }, 3500);

      try {
        unsubscribe = db.collection('reports').orderBy('reportDate', 'desc').onSnapshot(snapshot => {
          delivered = true;
          clearTimeout(fallback);
          const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          window.__WATER_REPORTS_CACHE__ = reports;
          callback(reports);
        }, error => {
          delivered = true;
          clearTimeout(fallback);
          console.error('Reports listener failed:', error);
          callback(window.__WATER_REPORTS_CACHE__ || []);
          setTimeout(() => {
            window.App?.toast?.('تم فتح اللوحة، لكن تعذر تحميل التقارير من Firestore مؤقتًا.', 'warn');
          }, 400);
        });
      } catch (error) {
        delivered = true;
        clearTimeout(fallback);
        console.error('Reports listener crashed:', error);
        callback(window.__WATER_REPORTS_CACHE__ || []);
      }

      return () => {
        clearTimeout(fallback);
        try { unsubscribe?.(); } catch {}
      };
    };

    window.FirebaseService.__startupStabilityPatched = true;
  }

  function patchLayoutSafety() {
    if (!window.AppUI || window.AppUI.__layoutSafetyPatched) return;
    const originalLayout = window.AppUI.layout;
    window.AppUI.layout = function safeLayout(state, settings) {
      try {
        return originalLayout(state, settings);
      } catch (error) {
        console.error('Layout render failed:', error);
        return `<main class="app-shell"><header class="hero"><div><p class="eyebrow">لوحة التشغيل</p><h1>نظام تقارير تشغيل وضخ المياه</h1><p>تم فتح اللوحة بوضع آمن بسبب خطأ مؤقت في الواجهة.</p></div><div class="hero-actions"><button class="btn primary big" onclick="location.reload()">إعادة تحميل</button><button class="btn" onclick="App.logout()">خروج</button></div></header><section class="cards-section"><h2>تعذر عرض البيانات مؤقتًا</h2><p>أعد تحميل الصفحة. إذا تكرر الخطأ، يتم فحص آخر تعديل في الواجهة.</p></section></main>`;
      }
    };
    window.AppUI.__layoutSafetyPatched = true;
  }

  function boot() {
    patchListenReports();
    patchLayoutSafety();
  }

  boot();
  window.addEventListener('DOMContentLoaded', boot);
})();


/* ==========================================
   FILE: stable-layout-reset.js
   ========================================== */
(() => {
  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function n(value) {
    return window.ReportUtils?.number ? window.ReportUtils.number(value) : Number(value || 0) || 0;
  }

  function fmt(value, digits = 2) {
    const x = Number(value);
    if (!Number.isFinite(x)) return '0';
    const r = +x.toFixed(digits);
    return Number.isInteger(r) ? String(r) : String(r);
  }

  function hours(value) {
    if (!value) return 0;
    const parts = String(value).split(':').map(Number);
    if (parts.length >= 2) return (parts[0] || 0) + ((parts[1] || 0) / 60);
    return n(value);
  }

  function summary(reports) {
    const list = reports || [];
    const data = list.reduce((acc, r) => {
      acc.runHours += hours(r?.generator?.totalRunHours);
      acc.waterProduction += n(r?.water?.dailyProduction);
      acc.rejectWater += n(r?.water?.rejectWater);
      acc.filledWater += n(r?.water?.filledWater);
      acc.cars += n(r?.water?.carsCount);
      return acc;
    }, { runHours: 0, fuelConsumed: 0, fuelSupplied: 0, waterProduction: 0, rejectWater: 0, filledWater: 0, cars: 0 });
    data.lossPercentage = data.waterProduction ? (data.rejectWater / data.waterProduction) * 100 : 0;

    const raw = Array.isArray(window.WaterFuelRawEntries) ? window.WaterFuelRawEntries : [];
    const uniqueRaw = [];
    const seen = new Set();
    raw.forEach(item => {
      const key = [item.type || 'incoming', item.date || '', item.time || '', item.supplier || item.donor || item.consumedFor || '', item.quantityLiters ?? item.quantity ?? '', item.fillingMethod || '', item.deliveredBy || item.receivedBy || ''].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      uniqueRaw.push(item);
    });

    const incoming = uniqueRaw.filter(x => x.type !== 'consumed').reduce((s, x) => s + n(x.quantityLiters ?? x.quantity), 0);
    const consumed = uniqueRaw.filter(x => x.type === 'consumed').reduce((s, x) => s + n(x.quantityLiters ?? x.quantity), 0);
    
    data.fuelConsumed = consumed;
    data.fuelSupplied = incoming;
    data.stock = incoming - consumed;
    
    const latestEntry = [...uniqueRaw].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    data.stockDate = latestEntry ? latestEntry.date : '';
    
    return data;
  }

  function can(permission) {
    if (!window.AuthUsers) return true;
    const user = window.AuthUsers.currentUser?.();
    if (!user) return true;
    if (user.role === 'superAdmin') return true;
    return window.AuthUsers.hasPermission?.(permission) === true;
  }

  function button(permission, html) {
    return can(permission) ? html : '';
  }

  function kpi(icon, label, value, hint = '', theme = 'primary') {
    return `<article class="kpi-card kpi-card-hoverable"><div class="kpi-icon kpi-icon-${theme}">${icon}</div><div class="kpi-details"><span>${esc(label)}</span><strong>${esc(value)}</strong>${hint ? `<small>${esc(hint)}</small>` : ''}</div></article>`;
  }

  function card(report, activeId) {
    const r = window.ReportUtils?.recalc ? window.ReportUtils.recalc(report) : report;
    const date = window.ReportUtils?.displayDate ? window.ReportUtils.displayDate(r.reportDate) : (r.reportDate || '-');
    const warnings = Array.isArray(r.warnings) ? r.warnings.length : 0;
    const badge = warnings ? `<b class="card-badge warn" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 2px 8px; border-radius: 12px; font-size: 11px;">${warnings} تنبيه</b>` : ``;
    
    return `<button class="report-card ${r.id === activeId ? 'active' : ''}" onclick="App.select('${esc(r.id)}')" style="display: flex; flex-direction: column; gap: 8px; padding: 16px; text-align: right; width: 100%; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; transition: all 0.2s ease;">
      <div style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 13px; color: var(--text-muted); font-weight: 700; display: flex; align-items: center; gap: 6px;"><i style="opacity: 0.7;">📅</i> ${date}</span>
        ${badge}
      </div>
      <strong style="font-size: 18px; color: var(--text-main); font-weight: 800; margin: 4px 0;">${esc(r.stationName || r.title || 'محطة رئيسية')}</strong>
      <div style="font-size: 13px; color: var(--text-muted); font-weight: 600; display: flex; align-items: center; gap: 6px;">
        <i style="opacity: 0.7;">👤</i> ${esc(r.operatorName || '-')}
      </div>
      <div style="display: flex; gap: 12px; font-size: 13px; font-weight: 700; background: var(--bg-main); padding: 8px 12px; border-radius: 8px; width: 100%; border: 1px solid var(--border-color); align-items: center; margin-top: 4px;">
        <span style="color: var(--primary); display: flex; align-items: center; gap: 4px;">💧 ${fmt(n(r.water?.dailyProduction))} كوب</span>
        <span style="color: var(--text-muted); display: flex; align-items: center; gap: 4px;">⏱️ ${esc(r.generator?.totalRunHours || '-')}</span>
      </div>
    </button>`;
  }

  function detail(report) {
    if (!report) {
      return `<section id="reportDetails" class="details empty-state details-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; opacity: 0.9; animation: fadeIn 0.4s ease;">
        <div style="font-size: 96px; margin-bottom: 24px; filter: drop-shadow(0 10px 15px rgba(0,0,0,0.1));">📊</div>
        <h2 style="font-size: 26px; font-weight: 900; color: var(--text-main); margin-bottom: 12px;">تحليل البيانات الذكي</h2>
        <p style="font-size: 16px; color: var(--text-muted); max-width: 320px; line-height: 1.6; font-weight: 500;">اختر تقريراً من القائمة الجانبية لعرض تفاصيله الكاملة هنا في واجهة تحليل متقدمة وسهلة القراءة.</p>
      </section>`;
    }
    const r = window.ReportUtils?.recalc ? window.ReportUtils.recalc(report) : report;
    const date = window.ReportUtils?.displayDate ? window.ReportUtils.displayDate(r.reportDate) : (r.reportDate || '-');
    const warnings = (r.warnings || []).length ? `<div class="notice warn">${r.warnings.map(w => `<p>${esc(w)}</p>`).join('')}</div>` : '';
    const actions = [
      button('editReports', `<button class="btn primary action-float" onclick="App.openEdit('${esc(r.id)}')">✏️ تعديل التقرير</button>`),
      button('shareWhatsapp', `<button class="btn action-float" onclick="App.copyWhatsApp('${esc(r.id)}')">🟢 واتساب</button>`),
      button('exportPdf', `<button class="btn action-float" onclick="App.exportPdf('${esc(r.id)}')">📄 PDF</button>`),
      button('exportExcel', `<button class="btn action-float" onclick="App.exportOneExcel('${esc(r.id)}')">📊 Excel</button>`),
      button('deleteReports', `<button class="btn danger" onclick="App.deleteReport('${esc(r.id)}')">🗑️ حذف</button>`)
    ].join('');
    return `<section id="reportDetails" class="details details-reveal"><div class="section-head details-title"><div><p class="eyebrow">تفاصيل التقرير</p><h2>${esc(r.title || '')}</h2></div></div>${warnings}<div class="detail-grid"><article><span>التاريخ</span><strong>${date}</strong></article><article><span>المحطة</span><strong>${esc(r.stationName || '-')}</strong></article><article><span>ساعات التشغيل</span><strong>${esc(r.generator?.totalRunHours || '-')}</strong></article><article><span>الوقود المستهلك</span><strong>${fmt(n(r.fuel?.consumedDaily))} لتر</strong></article><article><span>الإنتاج اليومي</span><strong>${fmt(n(r.water?.dailyProduction))} كوب</strong></article><article><span>المعبأ</span><strong>${fmt(n(r.water?.filledWater))} كوب</strong></article><article><span>السيارات</span><strong>${fmt(n(r.water?.carsCount), 0)}</strong></article><article><span>نسبة الفاقد</span><strong>${fmt(n(r.water?.lossPercentage))}%</strong></article></div><div class="report-actions-panel">${actions}</div></section>`;
  }

  function reportModal() {
    return `<div id="reportModal" class="modal"><div class="modal-backdrop" onclick="App.closeModal()"></div><div class="modal-panel large"><button class="close" onclick="App.closeModal()">×</button><div class="modal-title"><span>📋</span><div><h2>إضافة / تعديل تقرير</h2><p>استخدم التعبئة التلقائية أو عدّل الحقول يدويًا قبل الحفظ.</p></div></div><div class="auto-box"><button class="btn primary action-float" onclick="App.togglePaste()">تعبئة تلقائية من نص التقرير</button><textarea id="pasteText" class="smart-input hidden" placeholder="الصق تقرير واتساب الكامل هنا..."></textarea><div class="actions"><button id="parseBtn" class="btn hidden" onclick="App.parseText()">تحليل النص وملء الحقول</button></div></div><div id="formHost"></div><div class="actions modal-actions"><button class="btn primary big action-float" onclick="App.saveReport()">حفظ التقرير</button><button class="btn" onclick="App.closeModal()">إلغاء</button></div></div></div>`;
  }

  function settingsModal(settings) {
    if (window.AppUI?.settingsModal) return window.AppUI.settingsModal(settings || {});
    return '';
  }

  function usersModal() {
    if (!can('manageUsers')) return '';
    return `<div id="usersModal" class="modal"><div class="modal-backdrop" onclick="UsersUI.close()"></div><div class="modal-panel users-panel"><button class="close" onclick="UsersUI.close()">×</button><div class="modal-title"><span>👥</span><div><h2>إدارة المستخدمين والصلاحيات</h2><p>إضافة مستخدمين وتحديد صلاحياتهم.</p></div></div><div id="usersContent"></div></div></div>`;
  }

  function sidebarMenu(reportsLength, active = null) {
    const state = window.App?.state || { view: 'home', sidebarPinned: true };
    const user = window.AuthUsers?.currentUser?.();
    const role = user ? esc(user.roleLabel || user.role) : '';
    return `<aside class="app-sidebar ${state.sidebarPinned ? 'pinned' : ''}">
      <div class="sidebar-brand">
        <div class="brand-icon">💧</div>
        <div class="brand-text">
          <h2>WaterDash</h2>
          <span>منصة التشغيل</span>
        </div>
        <button class="icon-btn sidebar-pin-btn" onclick="App.toggleSidebar()" title="تثبيت/إخفاء القائمة">
          ${state.sidebarPinned ? '📌' : '📍'}
        </button>
      </div>
      
      <div class="sidebar-user">
        <div class="user-avatar">${user ? esc(user.fullName).charAt(0) : 'U'}</div>
        <div class="user-info">
          <strong>${user ? esc(user.fullName) : 'مستخدم'}</strong>
          <span>${role}</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <p class="nav-section-title">القائمة الرئيسية</p>
        ${button('viewReports', `<button id="nav-home" class="nav-item ${state.view === 'home' ? 'active' : ''}" onclick="App.goHome()"><i class="icon">📊</i><span>لوحة البيانات</span></button>`)}
        ${button('viewReports', `<button id="nav-reports" class="nav-item ${state.view === 'reports' ? 'active' : ''}" onclick="App.goReports()"><i class="icon">📋</i><span>سجل التقارير <b class="badge">${reportsLength}</b></span></button>`)}
        ${button('createReports', `<button id="nav-form" class="nav-item highlight ${state.view === 'form' ? 'active' : ''}" onclick="App.openNew()"><i class="icon">➕</i><span>إضافة تقرير</span></button>`)}
        ${button('exportExcel', `<button id="nav-export" class="nav-item ${state.view === 'export' ? 'active' : ''}" onclick="App.goExport()"><i class="icon">📥</i><span>تصدير مخصص</span></button>`)}

        <p class="nav-section-title">الإدارة</p>
        ${button('manageUsers', `<button id="nav-users" class="nav-item ${state.view === 'users' ? 'active' : ''}" onclick="UsersUI.open()"><i class="icon">👥</i><span>المستخدمون</span></button>`)}
        ${button('manageSettings', `<button id="nav-settings" class="nav-item ${state.view === 'settings' ? 'active' : ''}" onclick="App.openSettings()"><i class="icon">⚙️</i><span>الإعدادات</span></button>`)}
        <button class="nav-item danger-text" onclick="App.logout()"><i class="icon">🚪</i><span>تسجيل الخروج</span></button>
      </nav>
    </aside>`;
  }

  function stableLayout(state, settings = {}) {
    let reports = (state?.reports || []).map(r => window.ReportUtils?.recalc ? window.ReportUtils.recalc(r) : r);
    const active = reports.find(r => r.id === state?.currentId) || null;
    
    // Filter reports specifically for the dashboard stats and visualizations
    const todayStr = new Date().toISOString().split('T')[0];
    let dashboardReports = [...reports];
    
    const dashboardDateRange = state.dashboardDateRange || 'all';
    if (dashboardDateRange === 'today') {
      dashboardReports = dashboardReports.filter(r => r.reportDate === todayStr);
    } else if (dashboardDateRange === 'week') {
      const d = new Date(); d.setDate(d.getDate() - 7);
      const weekAgo = d.toISOString().split('T')[0];
      dashboardReports = dashboardReports.filter(r => r.reportDate >= weekAgo);
    } else if (dashboardDateRange === 'month') {
      const d = new Date(); d.setDate(1);
      const monthStart = d.toISOString().split('T')[0];
      dashboardReports = dashboardReports.filter(r => r.reportDate >= monthStart);
    }
    
    const dashboardStation = state.dashboardStation || 'all';
    if (dashboardStation !== 'all') {
      dashboardReports = dashboardReports.filter(r => r.stationName === dashboardStation);
    }
    
    const s = summary(dashboardReports);
    
    // Live operational status detection
    const latestReport = reports[0];
    const isGeneratorRunning = latestReport?.generator?.status === 'يعمل' || latestReport?.generator?.periods?.[0]?.startTime;
    
    let visibleReports = [...reports];
    if (state.uiFilter === 'today' && todayStr) {
       visibleReports = visibleReports.filter(r => r.reportDate === todayStr);
    } else if (state.uiFilter === 'week') {
       const d = new Date(); d.setDate(d.getDate() - 7);
       const weekAgo = d.toISOString().split('T')[0];
       visibleReports = visibleReports.filter(r => r.reportDate >= weekAgo);
    } else if (state.uiFilter === 'alerts' && window.WaterDataQualityPro?.classify) {
       visibleReports = visibleReports.filter(r => window.WaterDataQualityPro.classify(r).critical > 0);
    }

    const fuelPct = Math.min(Math.round((s.stock / 1000) * 100), 100) || 0;
    const isCritical = s.stock < 200;

    return `<div class="dashboard-layout">
      ${sidebarMenu(reports.length, active)}
      
      <main class="dashboard-main">
        <header class="top-header">
          <div class="header-search" style="display: flex; align-items: center; gap: 8px; width: auto; background: transparent; box-shadow: none; padding: 0;">
            <div class="live-status-container" style="display: flex; align-items: center; gap: 8px; background: var(--bg-card); padding: 8px 16px; border-radius: 20px; border: 1px solid var(--border-color); box-shadow: var(--card-shadow);">
              <span class="live-status-dot" style="width: 10px; height: 10px; border-radius: 50%; display: inline-block; background: ${isGeneratorRunning ? '#10b981' : '#ef4444'}; box-shadow: 0 0 10px ${isGeneratorRunning ? '#10b981' : '#ef4444'}; animation: pulse-status 1.5s infinite;"></span>
              <b style="font-size: 13px; font-weight: 700; color: var(--text-main);">${isGeneratorRunning ? 'حالة التشغيل: نشط (المولد يعمل)' : 'حالة التشغيل: متوقف مؤقتاً / صيانة'}</b>
            </div>
          </div>
          <div class="header-actions">
            <button class="icon-btn theme-toggle" type="button" onclick="App.toggleTheme()" title="تغيير المظهر">🌙</button>
            <button class="icon-btn" id="headerHardRefreshBtn" type="button" onclick="App.hardRefresh()" title="تحديث قوي">↻</button>
            <button class="icon-btn">🔔</button>
            <div class="date-badge">${window.ReportUtils?.displayDate ? window.ReportUtils.displayDate(new Date().toISOString().split('T')[0]) : 'اليوم'}</div>
          </div>
        </header>

        <div class="dashboard-content">
          ${state.view === 'form' ? `<div id="formHost">${window.AppUI.reportForm(state.draft || state, settings)}</div>` : `
          <div id="dashboard-tab-content" style="display: ${state.view === 'home' ? 'block' : 'none'};">
            
            <!-- Glassmorphism Smart Alerts Banner -->
            <div class="smart-alerts-banner" style="backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); background: linear-gradient(135deg, rgba(239, 68, 68, 0.04) 0%, rgba(245, 158, 11, 0.04) 100%); border: 1px solid var(--border-color); padding: 20px 24px; border-radius: 24px; color: var(--text-main); display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px; box-shadow: var(--card-shadow); border-right: 4px solid #ef4444;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="font-size: 18px;">📢</span>
                <span style="font-size: 14px; font-weight: 800; color: var(--text-main); letter-spacing: -0.3px;">التنبيهات التشغيلية والتحليلات الذكية</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 12px; background: rgba(245, 158, 11, 0.06); padding: 10px 16px; border-radius: 12px; border: 1px solid rgba(245, 158, 11, 0.12); color: #f97316; font-size: 13px; font-weight: 700; width: 100%;">
                  <span style="font-size: 16px; flex-shrink: 0;">⚠️</span> 
                  <span style="line-height: 1.5; flex-grow: 1;">تنبيه: تم رصد انخفاض بنسبة 12% في كفاءة ترشيح المياه خلال التقارير الثلاثة الأخيرة. يرجى فحص فلاتر تحلية المياه.</span>
                  <button onclick="App.openExplainModal()" style="margin-right: auto; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); color: #f97316; padding: 4px 10px; border-radius: 20px; font-size: 11px; cursor: pointer; font-weight: 800; display: flex; align-items: center; gap: 4px; border-style: solid; font-family: inherit; transition: all 0.2s; flex-shrink: 0;" onmouseover="this.style.background='rgba(245,158,11,0.25)'" onmouseout="this.style.background='rgba(245,158,11,0.15)'">
                    <span>💡 الشرح والتحليل</span>
                  </button>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; background: rgba(239, 68, 68, 0.06); padding: 10px 16px; border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.12); color: #ef4444; font-size: 13px; font-weight: 700;">
                  <span style="font-size: 16px; flex-shrink: 0;">⛽</span> 
                  <span style="line-height: 1.5;">تنبيه: رصيد الديزل الحالي يكفي لأربعة أيام تشغيل فقط.</span>
                </div>
              </div>
            </div>

            <div class="section-header" style="margin-bottom:24px; display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; align-items: center;">
              <h2>نظرة عامة على البيانات</h2>
              
              <!-- top-level filter controls -->
              <div class="dashboard-filters-panel" style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; background: var(--bg-card); padding: 8px 16px; border-radius: 30px; border: 1px solid var(--border-color); box-shadow: var(--card-shadow);">
                <div style="display: flex; gap: 6px;">
                  <button class="btn small ${(!state.dashboardDateRange || state.dashboardDateRange === 'all') ? 'primary' : 'ghost'}" style="border-radius: 20px; padding: 6px 14px; font-size: 13px;" onclick="App.setDashboardDateRange('all')">الكل</button>
                  <button class="btn small ${state.dashboardDateRange === 'today' ? 'primary' : 'ghost'}" style="border-radius: 20px; padding: 6px 14px; font-size: 13px;" onclick="App.setDashboardDateRange('today')">اليوم</button>
                  <button class="btn small ${state.dashboardDateRange === 'week' ? 'primary' : 'ghost'}" style="border-radius: 20px; padding: 6px 14px; font-size: 13px;" onclick="App.setDashboardDateRange('week')">آخر 7 أيام</button>
                  <button class="btn small ${state.dashboardDateRange === 'month' ? 'primary' : 'ghost'}" style="border-radius: 20px; padding: 6px 14px; font-size: 13px;" onclick="App.setDashboardDateRange('month')">هذا الشهر</button>
                </div>
                <div style="width: 1px; height: 24px; background: var(--border-color);"></div>
                <select onchange="App.setDashboardStation(this.value)" style="border: none; background: transparent; color: var(--text-main); font-family: inherit; font-size: 13px; font-weight: 700; outline: none; cursor: pointer; padding: 0 8px;">
                  <option value="all" ${state.dashboardStation === 'all' ? 'selected' : ''}>جميع المحطات</option>
                  ${[...new Set(reports.map(r => r.stationName).filter(Boolean))].map(name => `<option value="${esc(name)}" ${state.dashboardStation === name ? 'selected' : ''}>${esc(name)}</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- Section 1: Operation & Fuel -->
            <div class="dashboard-section-title" style="font-size: 15px; font-weight: 800; color: var(--text-main); margin: 24px 0 16px 0; display: flex; align-items: center; gap: 8px;">
              <span style="background: var(--primary); width: 4px; height: 16px; border-radius: 2px; display: inline-block;"></span>
              <span>كفاءة المولد ورصيد الديزل</span>
            </div>
            <section class="stats-grid operation-grid" style="margin-bottom:32px;">
              ${kpi('⏱️','إجمالي ساعات التشغيل',fmt(s.runHours),'ساعة', 'purple')}
              ${kpi('⛽','الوقود المستهلك',fmt(s.fuelConsumed),'لتر', 'danger')}
              ${kpi('🚛','الوقود المزود',fmt(s.fuelSupplied),'لتر', 'warning')}
              
              <!-- 3D Cylinder Fuel Tank Gauge -->
              <div class="kpi-card fuel-tank-card" style="padding: 12px 24px; display: flex; flex-direction: row; align-items: center; gap: 20px; grid-column: span 1;">
                <div class="tank-container" style="position: relative; width: 44px; height: 70px; flex-shrink: 0;">
                  <svg width="44" height="70" viewBox="0 0 60 95" style="overflow: visible;">
                    <!-- Cylinder body glass reflection -->
                    <rect x="0" y="8" width="60" height="74" rx="8" ry="8" fill="none" stroke="var(--border-color)" stroke-width="1.5" style="backdrop-filter: blur(5px); background: rgba(255, 255, 255, 0.03);"></rect>
                    <!-- Cylinder top cap -->
                    <ellipse cx="30" cy="8" rx="30" ry="6" fill="var(--bg-main)" stroke="var(--border-color)" stroke-width="1.5"></ellipse>
                    <!-- Cylinder bottom cap -->
                    <ellipse cx="30" cy="82" rx="30" ry="6" fill="var(--bg-main)" stroke="var(--border-color)" stroke-width="1.5"></ellipse>
                    <!-- Liquid content with clipPath -->
                    <g clip-path="url(#tank-clip)">
                      <clipPath id="tank-clip">
                        <rect x="1" y="8.5" width="58" height="73" rx="7" ry="7"></rect>
                      </clipPath>
                      <!-- Dynamic height of liquid -->
                      <rect x="0" y="${82 - (74 * (fuelPct/100))}" width="60" height="${74 * (fuelPct/100)}" fill="${isCritical ? '#ef4444' : '#10b981'}" style="transition: all 1s ease-in-out; opacity: 0.75; animation: ${isCritical ? 'pulse-fuel-liquid 1.2s infinite alternate' : 'none'};"></rect>
                      <!-- Wave effect on top of liquid -->
                      <ellipse cx="30" cy="${82 - (74 * (fuelPct/100))}" rx="30" ry="4" fill="${isCritical ? '#f87171' : '#34d399'}" style="transition: all 1s ease-in-out;"></ellipse>
                    </g>
                  </svg>
                  <div class="tank-label" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 10px; font-weight: 800; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.6);">${fuelPct}%</div>
                </div>
                <div class="kpi-details">
                  <span>مؤشر رصيد السولار</span>
                  <strong>${s.stock ? fmt(s.stock) : '_'} لتر</strong>
                  <small style="color: ${isCritical ? '#ef4444' : 'var(--text-muted)'}; font-weight: ${isCritical ? 'bold' : 'normal'}; animation: ${isCritical ? 'blink-text 1.2s infinite' : 'none'};">${isCritical ? '⚠️ رصيد منخفض! اطلب سولار' : `رصيد السولار الاحتياطي`}</small>
                </div>
              </div>
            </section>

            <!-- Section 2: Water Production & Distribution -->
            <div class="dashboard-section-title" style="font-size: 15px; font-weight: 800; color: var(--text-main); margin: 24px 0 16px 0; display: flex; align-items: center; gap: 8px;">
              <span style="background: #10b981; width: 4px; height: 16px; border-radius: 2px; display: inline-block;"></span>
              <span>كميات وتوزيع وإنتاج المياه</span>
            </div>
            <section class="stats-grid water-grid" style="margin-bottom:32px;">
              ${kpi('💧','إنتاج المياه اليومي',fmt(s.waterProduction),'كوب', 'success')}
              ${kpi('♻️','المياه الراجع',fmt(s.rejectWater),'كوب', 'emerald')}
              ${kpi('📉','نسبة الفاقد',fmt(s.lossPercentage) + '%','من إجمالي الإنتاج', 'info')}
              ${kpi('🧊','المياه المعبأة',fmt(s.filledWater),'كوب', 'primary')}
              ${kpi('🚚','السيارات المعبأة',fmt(s.cars,0),'سيارة', 'blue')}
            </section>
            
            <!-- Gorgeous Charts Section -->
            <section class="dashboard-charts-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px;">
              <div class="chart-card" style="background: var(--bg-card); padding: 24px; border-radius: 24px; border: 1px solid var(--border-color); box-shadow: var(--card-shadow);">
                <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 16px; font-weight: 700; color: var(--text-main);">💧 مخطط الإنتاج والرفض الأسبوعي (آخر 7 تقارير)</h3>
                <div style="position: relative; height: 260px; width: 100%;">
                  <canvas id="productionRejectChart"></canvas>
                </div>
              </div>
              <div class="chart-card" style="background: var(--bg-card); padding: 24px; border-radius: 24px; border: 1px solid var(--border-color); box-shadow: var(--card-shadow);">
                <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 16px; font-weight: 700; color: var(--text-main);">⛽ معدل استهلاك الديزل اليومي (لتر/ساعة تشغيل)</h3>
                <div style="position: relative; height: 260px; width: 100%;">
                  <canvas id="fuelConsumptionChart"></canvas>
                </div>
              </div>
            </section>
          </div>

          <div id="reports-tab-content" style="display: ${state.view === 'reports' ? 'block' : 'none'};">
            <div class="dashboard-split">
              <section id="reports" class="reports-section">
                <div class="section-header">
                  <h2>التقارير الأخيرة</h2>
                  <div class="section-actions">
                    ${button('createReports', `<button class="btn ghost" onclick="App.duplicateLastReport()">⧉ تكرار الأخير</button>`)}
                    <button class="btn icon-btn">⋮</button>
                  </div>
                </div>
                <div style="display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none;">
                  <button class="btn small ${(!state.uiFilter || state.uiFilter === 'all') ? 'primary' : 'ghost'}" style="border-radius: 20px; padding: 6px 16px; flex-shrink: 0;" onclick="App.setUIFilter('all')">الكل</button>
                  <button class="btn small ${state.uiFilter === 'today' ? 'primary' : 'ghost'}" style="border-radius: 20px; padding: 6px 16px; flex-shrink: 0;" onclick="App.setUIFilter('today')">اليوم</button>
                  <button class="btn small ${state.uiFilter === 'week' ? 'primary' : 'ghost'}" style="border-radius: 20px; padding: 6px 16px; flex-shrink: 0;" onclick="App.setUIFilter('week')">الأسبوع</button>
                  <button class="btn small ${state.uiFilter === 'alerts' ? 'primary' : 'ghost'}" style="border-radius: 20px; padding: 6px 16px; color: ${state.uiFilter === 'alerts' ? '#fff' : '#ef4444'}; border: 1px solid rgba(239, 68, 68, 0.2); background: ${state.uiFilter === 'alerts' ? '#ef4444' : 'rgba(239, 68, 68, 0.05)'}; flex-shrink: 0;" onclick="App.setUIFilter('alerts')">🔴 تنبيهات</button>
                </div>
                <div class="reports-list">
                  ${visibleReports.map(r => card(r, active?.id)).join('') || '<div class="empty-mini">لا توجد تقارير مطابقة للبحث.</div>'}
                </div>
              </section>

              <div class="details-wrapper">
                ${detail(active)}
              </div>
            </div>
          </div>
          
          <div id="export-tab-content" style="display: ${state.view === 'export' ? 'block' : 'none'};">
            <div class="section-header" style="margin-bottom:24px;"><h2>تصدير مخصص للبيانات</h2></div>
            <div class="form-grid" style="max-width: 600px; margin: 0 auto; background: var(--bg-card); padding: 32px; border-radius: 24px; box-shadow: var(--card-shadow); gap: 16px;">
              <label>من تاريخ</label>
              <input type="date" id="exportStartDate" class="export-input">
              <label>إلى تاريخ</label>
              <input type="date" id="exportEndDate" class="export-input">
              <label>اختر المحطة (اختياري)</label>
              <select id="exportStation" class="export-input">
                <option value="">جميع المحطات</option>
                ${[...new Set(reports.map(r => r.stationName).filter(Boolean))].map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('')}
              </select>
              <label>نوع البيانات المراد تصديرها</label>
              <select id="exportDataType" class="export-input">
                <option value="all">كافة البيانات (ملف كامل بجميع الأقسام)</option>
                <option value="General">البيانات العامة الأساسية</option>
                <option value="Generator">بيانات المولد وساعات التشغيل</option>
                <option value="Fuel">بيانات الوقود</option>
                <option value="Water Quantities">كميات المياه (المعبأة، الفاقد، الإنتاج)</option>
                <option value="Water Tests">فحوصات المياه (TDS, PH)</option>
                <option value="Beneficiaries">سجل المستفيدين (الجهات)</option>
                <option value="Summary">الملخص الإجمالي للتقارير</option>
              </select>
              <div style="grid-column: 1 / -1; margin-top: 24px; display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                <button class="btn" onclick="App.exportFilteredExcel()" style="background: rgba(16, 185, 129, 0.2); border-color: rgba(16, 185, 129, 0.4); color: #10b981; justify-content: center;">
                  <i class="icon">📊</i> تصدير Excel
                </button>
                <button class="btn" onclick="App.exportFilteredWord()" style="background: rgba(59, 130, 246, 0.2); border-color: rgba(59, 130, 246, 0.4); color: #3b82f6; justify-content: center;">
                  <i class="icon">📝</i> تصدير Word
                </button>
                <button class="btn" onclick="App.exportFilteredPDF()" style="background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.4); color: #ef4444; justify-content: center;">
                  <i class="icon">📄</i> تصدير PDF
                </button>
                <button class="btn" onclick="App.exportFilteredImage()" style="background: rgba(245, 158, 11, 0.2); border-color: rgba(245, 158, 11, 0.4); color: #f59e0b; justify-content: center;">
                  <i class="icon">🖼️</i> حفظ كصورة
                </button>
                <button class="btn" onclick="App.exportFilteredWhatsApp()" style="background: rgba(34, 197, 94, 0.2); border-color: rgba(34, 197, 94, 0.4); color: #22c55e; justify-content: center;">
                  <i class="icon">💬</i> مشاركة WhatsApp
                </button>
              </div>
            </div>
          </div>
          
          <div id="settings-tab-content" style="display: ${state.view === 'settings' ? 'block' : 'none'};">
            <div class="section-header" style="margin-bottom:24px;">
              <h2>⚙️ الإعدادات الذكية</h2>
              <p style="color: var(--text-muted); font-size: 13px; margin: 4px 0 0 0;">الكروت المرجعية للحقول الثابتة في المحطة</p>
            </div>
            <div style="background: var(--bg-card); padding: 32px; border-radius: 24px; box-shadow: var(--card-shadow); border: 1px solid var(--border-color);">
              <form id="settingsForm" class="form-grid settings-form">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
                  <article class="setting-card" style="background: var(--bg-card); padding: 16px; border-radius: 16px; border: 1px solid var(--border-color);">
                    <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
                      <div style="font-size: 24px;">💧</div>
                      <div><h3 style="margin: 0; font-size: 15px;">المياه الحلوة</h3><small style="color: var(--text-muted); font-size: 11px;">الإنتاج في الساعة</small></div>
                    </div>
                    <input name="filteredRate" type="number" placeholder="مثال: 33" value="${settings.filteredRate || ''}" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main);">
                  </article>
                  <article class="setting-card" style="background: var(--bg-card); padding: 16px; border-radius: 16px; border: 1px solid var(--border-color);">
                    <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
                      <div style="font-size: 24px;">♻️</div>
                      <div><h3 style="margin: 0; font-size: 15px;">نسبة الفاقد / العادم</h3><small style="color: var(--text-muted); font-size: 11px;">كنسبة مئوية %</small></div>
                    </div>
                    <input name="lossPercentage" type="number" step="0.01" placeholder="مثال: 32.74" value="${settings.lossPercentage !== undefined ? settings.lossPercentage : '32.74'}" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main);">
                  </article>
                  <article class="setting-card" style="background: var(--bg-card); padding: 16px; border-radius: 16px; border: 1px solid var(--border-color);">
                    <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
                      <div style="font-size: 24px;">⛽</div>
                      <div><h3 style="margin: 0; font-size: 15px;">استهلاك الوقود</h3><small style="color: var(--text-muted); font-size: 11px;">لتر في الساعة</small></div>
                    </div>
                    <input name="fuelRate" type="number" placeholder="مثال: 19" value="${settings.fuelRate || '19'}" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main);">
                  </article>
                  <article class="setting-card" style="background: var(--bg-card); padding: 16px; border-radius: 16px; border: 1px solid var(--border-color);">
                    <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
                      <div style="font-size: 24px;">🚚</div>
                      <div><h3 style="margin: 0; font-size: 15px;">سعة السيارة</h3><small style="color: var(--text-muted); font-size: 11px;">متوسط الأكواب للسيارة</small></div>
                    </div>
                    <input name="carCapacity" type="number" placeholder="مثال: 11.5" value="${settings.carCapacity || ''}" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main);">
                  </article>
                  <article class="setting-card" style="background: var(--bg-card); padding: 16px; border-radius: 16px; border: 1px solid var(--border-color);">
                    <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
                      <div style="font-size: 24px;">🚰</div>
                      <div><h3 style="margin: 0; font-size: 15px;">إنتاج الغاطس</h3><small style="color: var(--text-muted); font-size: 11px;">للمراقبة والمقارنة</small></div>
                    </div>
                    <input name="submersibleRate" type="number" placeholder="مثال: 55" value="${settings.submersibleRate || ''}" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main);">
                  </article>
                  <article class="setting-card" style="background: var(--bg-card); padding: 16px; border-radius: 16px; border: 1px solid var(--border-color);">
                    <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
                      <div style="font-size: 24px;">🧪</div>
                      <div><h3 style="margin: 0; font-size: 15px;">فحوصات افتراضية</h3><small style="color: var(--text-muted); font-size: 11px;">TDS أو غيرها</small></div>
                    </div>
                    <input name="defaultTests" type="text" placeholder="مثال: TDS:110" value="${esc(settings.defaultTests || '')}" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main);">
                  </article>
                </div>
                <section class="wide settings-grid" style="border-top: 1px solid var(--border-color); padding-top: 24px; gap: 12px;">
                  <h3 style="margin-bottom: 0px; font-size: 16px; grid-column: 1 / -1;">إعدادات نصوص التقرير</h3>
                  <label>اسم المحطة الافتراضي<input name="defaultStationName" value="${esc(settings.defaultStationName || '')}"></label>
                  <label>اسم البئر الافتراضي<input name="defaultWellName" value="${esc(settings.defaultWellName || '')}"></label>
                  <label>اسم المشغل الافتراضي<input name="defaultOperatorName" value="${esc(settings.defaultOperatorName || '')}"></label>
                  <label>حالة المولد الافتراضية<input name="defaultGeneratorStatus" value="${esc(settings.defaultGeneratorStatus || 'يعمل')}"></label>
                  <label class="wide">قوالب الجهات المستفيدة <small>اكتب كل جهة في سطر مستقل</small><textarea name="beneficiaries" rows="4">${esc((settings.beneficiaries || []).join('\n'))}</textarea></label>
                </section>
                
                <section class="wide settings-grid" style="border-top: 1px solid var(--border-color); padding-top: 24px; gap: 12px; margin-top: 16px;">
                  <h3 style="margin-bottom: 8px; font-size: 16px; grid-column: 1 / -1;">نطاق تطبيق القيم الثابتة</h3>
                  <div style="display: flex; flex-direction: column; gap: 12px; grid-column: 1 / -1; background: var(--bg-card); padding: 16px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex-direction: row; font-weight: normal;">
                      <input type="radio" name="applyScope" value="future" checked style="width: auto; margin: 0;">
                      تطبيق التعديلات على <strong>التقارير المستقبلية فقط</strong> (الخيار الآمن والافتراضي).
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex-direction: row; font-weight: normal;">
                      <input type="radio" name="applyScope" value="past_no_fuel" style="width: auto; margin: 0;">
                      تطبيق على <strong>جميع التقارير السابقة والمستقبلية</strong> (لتحديث كميات المياه والفاقد فقط دون تغيير أرصدة الوقود التراكمية).
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex-direction: row; font-weight: normal; color: #d32f2f;">
                      <input type="radio" name="applyScope" value="past_with_fuel" style="width: auto; margin: 0;">
                      تطبيق شامل على <strong>التقارير السابقة والمستقبلية + إعادة بناء أرصدة الوقود التراكمية</strong> (انتباه: سيغير رصيد الوقود الحالي!).
                    </label>
                  </div>
                </section>
              </form>
              <div class="actions modal-actions" style="margin-top: 24px; border-top: 1px solid var(--border-color); padding-top: 20px;">
                <button class="btn primary big action-float" onclick="App.saveSettings()">حفظ الإعدادات</button>
                <button class="btn" onclick="App.resetSettings()">استرجاع الافتراضي</button>
              </div>
            </div>
          </div>
          
          <div id="users-tab-content" style="display: ${state.view === 'users' ? 'block' : 'none'};">
            <div class="section-header" style="margin-bottom:24px;">
              <h2>👥 إدارة المستخدمين والصلاحيات</h2>
              <p style="color: var(--text-muted); font-size: 13px; margin: 4px 0 0 0;">إضافة مستخدمين، تحديد أدوارهم، وتفعيل أو تعطيل الصلاحيات.</p>
            </div>
            <div style="background: var(--bg-card); padding: 32px; border-radius: 24px; box-shadow: var(--card-shadow); border: 1px solid var(--border-color);">
              <div id="usersContent"></div>
            </div>
          </div>
          
          `}
        </div>
      </main>
    </div>`;
  }


  function patch() {
    if (!window.AppUI) return;
    window.AppUI.layout = stableLayout;
    window.AppUI.__layoutResetPatched = true;
  }

  patch();
  window.addEventListener('DOMContentLoaded', patch);

  window.initDashboardCharts = function(state) {
    const ctx1 = document.getElementById('productionRejectChart');
    const ctx2 = document.getElementById('fuelConsumptionChart');
    if (!ctx1 || !ctx2) return;
    
    if (window.prodChartInstance) { window.prodChartInstance.destroy(); window.prodChartInstance = null; }
    if (window.fuelChartInstance) { window.fuelChartInstance.destroy(); window.fuelChartInstance = null; }
    
    const reports = state?.reports || [];
    const todayStr = new Date().toISOString().split('T')[0];
    let dashboardReports = [...reports];
    
    const dashboardDateRange = state.dashboardDateRange || 'all';
    if (dashboardDateRange === 'today') {
      dashboardReports = dashboardReports.filter(r => r.reportDate === todayStr);
    } else if (dashboardDateRange === 'week') {
      const d = new Date(); d.setDate(d.getDate() - 7);
      const weekAgo = d.toISOString().split('T')[0];
      dashboardReports = dashboardReports.filter(r => r.reportDate >= weekAgo);
    } else if (dashboardDateRange === 'month') {
      const d = new Date(); d.setDate(1);
      const monthStart = d.toISOString().split('T')[0];
      dashboardReports = dashboardReports.filter(r => r.reportDate >= monthStart);
    }
    
    const dashboardStation = state.dashboardStation || 'all';
    if (dashboardStation !== 'all') {
      dashboardReports = dashboardReports.filter(r => r.stationName === dashboardStation);
    }
    
    const last7 = [...dashboardReports].slice(0, 7).reverse();
    const labels = last7.map(r => window.ReportUtils?.displayDate ? window.ReportUtils.displayDate(r.reportDate) : r.reportDate);
    const prodData = last7.map(r => Number(r.water?.dailyProduction) || 0);
    const rejectData = last7.map(r => Number(r.water?.rejectWater) || 0);
    
    const fuelData = last7.map(r => {
      const consumed = Number(r.fuel?.consumedDaily) || 0;
      const [h, m=0] = String(r.generator?.totalRunHours || '0:0').split(':').map(Number);
      const hours = h + (m / 60);
      return hours ? +(consumed / hours).toFixed(2) : 0;
    });
    
    const isDark = document.body.classList.contains('theme-dark') || document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    
    window.prodChartInstance = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'المياه المحلاة المنتجة (كوب)',
            data: prodData,
            backgroundColor: 'rgba(16, 185, 129, 0.75)',
            borderColor: '#10b981',
            borderWidth: 1.5,
            borderRadius: 6
          },
          {
            label: 'المياه المرفوضة (كوب)',
            data: rejectData,
            backgroundColor: 'rgba(239, 68, 68, 0.75)',
            borderColor: '#ef4444',
            borderWidth: 1.5,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor, font: { family: 'Cairo', weight: 'bold', size: 11 } } }
        },
        scales: {
          x: { ticks: { color: textColor, font: { family: 'Cairo', size: 10 } }, grid: { display: false } },
          y: { ticks: { color: textColor, font: { family: 'Cairo', size: 10 } }, grid: { color: gridColor } }
        }
      }
    });
    
    let lineGradient = 'rgba(59, 130, 246, 0.1)';
    if (ctx2 && typeof ctx2.getContext === 'function') {
      try {
        const c2d = ctx2.getContext('2d');
        const grad = c2d.createLinearGradient(0, 0, 0, 250);
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
        grad.addColorStop(1, 'rgba(59, 130, 246, 0.00)');
        lineGradient = grad;
      } catch (e) {}
    }

    window.fuelChartInstance = new Chart(ctx2, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'معدل الاستهلاك (لتر/ساعة)',
          data: fuelData,
          borderColor: '#3b82f6',
          backgroundColor: lineGradient,
          fill: true,
          tension: 0.4,
          borderWidth: 2.5,
          pointBackgroundColor: '#2563eb',
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor, font: { family: 'Cairo', weight: 'bold', size: 11 } } }
        },
        scales: {
          x: { ticks: { color: textColor, font: { family: 'Cairo', size: 10 } }, grid: { display: false } },
          y: { ticks: { color: textColor, font: { family: 'Cairo', size: 10 } }, grid: { color: gridColor } }
        }
      }
    });
  };
})();


/* ==========================================
   FILE: warning-actions.js
   ========================================== */
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


