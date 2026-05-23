window.App = (() => {
  const DEFAULT_SETTINGS = {
    defaultStationName: window.WATER_APP_SETTINGS?.defaultStationName || 'المحطة الرئيسية',
    defaultWellName: window.WATER_APP_SETTINGS?.defaultWellName || 'بئر رئيسي',
    defaultOperatorName: '',
    defaultGeneratorStatus: 'يعمل',
    submersibleRate: 55,
    filteredRate: 33,
    rejectRate: 22,
    freeChlorine: 0.4,
    beneficiaries: [
      'اطباء بلا حدود - فرنسا',
      'اطباء بلا حدود - هولندا',
      'مؤسسة سمير',
      'مصلحة مياه بلديات الساحل',
      'بلدية بيت لاهيا',
      'مياه خارجية / صنابير للمواطنين خارج المحطة'
    ]
  };
  const SETTINGS_KEY = 'waterAppDefaultSettings';
  const state = { reports: [], currentId: null, user: null, unsubscribe: null, editingId: null, draft: null, settings: loadLocalSettings() };

  function loadLocalSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return { ...DEFAULT_SETTINGS, ...saved, beneficiaries: Array.isArray(saved.beneficiaries) ? saved.beneficiaries : DEFAULT_SETTINGS.beneficiaries };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function setHtml(html) {
    document.getElementById('app').innerHTML = html;
    requestAnimationFrame(() => window.ThemeManager?.applyTheme(window.ThemeManager.current()));
  }

  function render() {
    setHtml(window.AppUI.layout(state, state.settings));
  }

  function toast(message, type = 'ok') {
    const wrap = document.createElement('div');
    wrap.className = `toast-message ${type}`;
    wrap.textContent = message;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('show'));
    setTimeout(() => {
      wrap.classList.remove('show');
      setTimeout(() => wrap.remove(), 220);
    }, 2600);
  }

  function confirmDialog({ title = 'تأكيد الإجراء', message = '', confirmText = 'تأكيد', cancelText = 'إلغاء', danger = false } = {}) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `<div class="confirm-card ${danger ? 'danger' : ''}"><div class="confirm-icon">${danger ? '⚠️' : '✅'}</div><h3>${window.AppUI.esc(title)}</h3><p>${window.AppUI.esc(message)}</p><div class="confirm-actions"><button class="btn ${danger ? 'danger' : 'primary'}" data-confirm="yes">${window.AppUI.esc(confirmText)}</button><button class="btn" data-confirm="no">${window.AppUI.esc(cancelText)}</button></div></div>`;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('show'));
      const close = result => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 180);
        resolve(result);
      };
      overlay.addEventListener('click', event => {
        if (event.target === overlay) close(false);
        if (event.target?.dataset?.confirm === 'yes') close(true);
        if (event.target?.dataset?.confirm === 'no') close(false);
      });
    });
  }

  function applyDefaults(report) {
    const r = window.ReportUtils.recalc(report || window.ReportUtils.emptyReport());
    r.stationName = r.stationName || state.settings.defaultStationName;
    r.wellName = r.wellName || state.settings.defaultWellName;
    r.operatorName = r.operatorName || state.settings.defaultOperatorName;
    r.generator.status = r.generator.status || state.settings.defaultGeneratorStatus;
    r.generator.operatorName = r.generator.operatorName || state.settings.defaultOperatorName;
    r.water.submersibleRate = r.water.submersibleRate || state.settings.submersibleRate;
    r.water.filteredRate = r.water.filteredRate || state.settings.filteredRate;
    r.tests.freeChlorine = r.tests.freeChlorine || state.settings.freeChlorine;
    return window.ReportUtils.recalc(r);
  }

  function reportWithTemplateBeneficiaries(report, keepExisting = true) {
    const r = window.ReportUtils.recalc(report || window.ReportUtils.emptyReport());
    const existing = Array.isArray(r.beneficiaries) ? r.beneficiaries : [];
    const byName = new Map(existing.map(item => [String(item.name || '').trim(), item]));
    const templates = state.settings.beneficiaries || [];
    const templateRows = templates.map((name, index) => {
      const old = byName.get(String(name).trim());
      return old || { id: `tpl-${Date.now()}-${index}`, name, quantity: '', cars: '', notes: '' };
    });
    const extras = keepExisting ? existing.filter(item => item.name && !templates.includes(item.name)) : [];
    r.beneficiaries = [...templateRows, ...extras];
    return window.ReportUtils.recalc(r);
  }

  async function loadRemoteSettings(user) {
    try {
      if (!user || !window.firebase?.firestore) return;
      const snap = await firebase.firestore().collection('settings').doc('main').get();
      if (!snap.exists) return;
      const data = snap.data() || {};
      state.settings = { ...state.settings, ...data, beneficiaries: Array.isArray(data.beneficiaries) ? data.beneficiaries : state.settings.beneficiaries };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    } catch (error) {
      console.warn('Could not load remote settings', error);
    }
  }

  function start() {
    if (!window.FirebaseService.isConfigured) {
      setHtml(window.AppUI.login(false));
      return;
    }
    setHtml(window.AppUI.skeleton());
    window.FirebaseService.onAuth(async user => {
      state.user = user;
      if (!user) {
        if (state.unsubscribe) state.unsubscribe();
        state.currentId = null;
        setHtml(window.AppUI.login(true));
        return;
      }
      window.ThemeManager?.loadUserTheme(user);
      await loadRemoteSettings(user);
      window.FirebaseService.seedSettings().catch(console.warn);
      if (state.unsubscribe) state.unsubscribe();
      state.unsubscribe = window.FirebaseService.listenReports(reports => {
        state.reports = reports;
        if (state.currentId && !reports.some(item => item.id === state.currentId)) state.currentId = null;
        render();
      });
    });
  }

  async function login(event) {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    try {
      setHtml(window.AppUI.skeleton());
      await window.FirebaseService.signIn(username, password);
      toast('تم تسجيل الدخول بنجاح', 'ok');
    } catch (error) {
      setHtml(window.AppUI.login(true));
      toast('بيانات الدخول غير صحيحة أو إعدادات Firebase غير مكتملة', 'warn');
    }
  }

  async function logout() {
    const ok = await confirmDialog({ title: 'تسجيل الخروج', message: 'هل تريد الخروج من النظام؟', confirmText: 'خروج', cancelText: 'بقاء' });
    if (!ok) return;
    await window.FirebaseService.signOut();
    toast('تم تسجيل الخروج', 'ok');
  }

  function select(id) {
    state.currentId = id;
    render();
    requestAnimationFrame(() => document.getElementById('reportDetails')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function openNew() {
    state.editingId = null;
    state.draft = reportWithTemplateBeneficiaries(applyDefaults(window.ReportUtils.emptyReport()), true);
    openModalWithDraft();
  }

  async function duplicateLastReport() {
    const source = state.reports?.[0];
    if (!source) {
      toast('لا يوجد تقرير سابق لتكراره', 'warn');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const copy = structuredClone(source);
    delete copy.id;
    delete copy.createdAt;
    delete copy.updatedAt;
    copy.reportDate = today;
    copy.title = `تقرير تشغيل وضخ المياه ${window.ReportUtils.displayDate(today)}`;
    copy.sourceText = '';
    copy.warnings = [];
    state.editingId = null;
    state.draft = applyDefaults(copy);
    openModalWithDraft();
    toast('تم تجهيز نسخة من آخر تقرير بتاريخ اليوم', 'ok');
  }

  function openEdit(id) {
    const report = state.reports.find(item => item.id === id);
    if (!report) return;
    state.editingId = id;
    state.draft = window.ReportUtils.recalc(report);
    openModalWithDraft();
  }

  function openModalWithDraft() {
    render();
    const modal = document.getElementById('reportModal');
    const host = document.getElementById('formHost');
    if (!modal || !host) return;
    host.innerHTML = window.AppUI.reportForm(state.draft, state.settings);
    modal.classList.add('open');
    bindTabs();
  }

  function closeModal() {
    const modal = document.getElementById('reportModal');
    if (modal) modal.classList.remove('open');
  }

  function togglePaste() {
    document.getElementById('pasteText')?.classList.toggle('hidden');
    document.getElementById('parseBtn')?.classList.toggle('hidden');
  }

  function parseText() {
    const host = document.getElementById('formHost');
    const paste = document.getElementById('pasteText');
    try {
      const text = paste?.value || '';
      if (!text.trim()) {
        toast('الصق نص التقرير أولًا', 'warn');
        return;
      }
      const parsed = window.ReportParser.parse(text);
      state.draft = applyDefaults(window.ReportUtils.fromParsed(parsed));
      const warnings = state.draft.warnings?.length
        ? `<div class="notice warn"><strong>تنبيهات التحليل:</strong>${state.draft.warnings.map(w => `<p>${window.AppUI.esc(w)}</p>`).join('')}</div>`
        : '';
      const info = `<div class="notice ok"><p>تم تحليل النص وملء الحقول.</p><p>التاريخ: ${window.ReportUtils.displayDate(state.draft.reportDate)} | الجهات: ${(state.draft.beneficiaries || []).length} | المياه: ${state.draft.water.filledWater || 0} كوب | السيارات: ${state.draft.water.carsCount || 0}</p></div>`;
      host.innerHTML = info + warnings + window.AppUI.reportForm(state.draft, state.settings);
      bindTabs();
      document.querySelector('[data-tab="general"]')?.click();
      host.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('تم تحليل التقرير وملء الحقول', 'ok');
    } catch (error) {
      const message = error?.message || 'تعذر تحليل النص.';
      if (host) host.insertAdjacentHTML('afterbegin', `<div class="notice warn"><p>${window.AppUI.esc(message)}</p></div>`);
      toast(message, 'warn');
      console.error(error);
    }
  }

  function bindTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', event => {
        event.preventDefault();
        const id = tab.dataset.tab;
        document.querySelectorAll('.tab').forEach(item => item.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(item => item.classList.remove('active'));
        tab.classList.add('active');
        document.querySelector(`[data-panel="${id}"]`)?.classList.add('active');
      });
    });
  }

  function collectForm() {
    const form = document.getElementById('reportForm');
    const data = new FormData(form);
    const beneficiaries = [...document.querySelectorAll('[data-b="name"]')].map(input => {
      const i = input.dataset.i;
      return {
        id: state.draft?.beneficiaries?.[i]?.id || `b-${Date.now()}-${i}`,
        name: input.value,
        quantity: document.querySelector(`[data-b="quantity"][data-i="${i}"]`)?.value || '',
        cars: document.querySelector(`[data-b="cars"][data-i="${i}"]`)?.value || '',
        notes: document.querySelector(`[data-b="notes"][data-i="${i}"]`)?.value || ''
      };
    }).filter(item => item.name || item.quantity || item.cars);

    const report = {
      ...(state.draft || window.ReportUtils.emptyReport()),
      title: data.get('title'),
      reportDate: data.get('reportDate'),
      stationName: data.get('stationName'),
      wellName: data.get('wellName'),
      operatorName: data.get('operatorName'),
      generalNotes: data.get('generalNotes'),
      generator: { periods: [{ startTime: data.get('generatorStart'), stopTime: data.get('generatorEnd'), runHours: data.get('totalRunHours') }], totalRunHours: data.get('totalRunHours'), status: data.get('generatorStatus'), operatorName: data.get('generatorOperator'), notes: data.get('generatorNotes'), extraFields: [] },
      fuel: { addedDaily: data.get('fuelAdded'), consumedDaily: data.get('fuelConsumed'), municipalSupplied: data.get('fuelMunicipal'), previousBalance: data.get('fuelPrevious'), currentBalance: data.get('fuelCurrent'), loss: data.get('fuelLoss'), notes: data.get('fuelNotes'), extraFields: [] },
      water: { submersibleRate: data.get('submersibleRate'), filteredRate: data.get('filteredRate'), dailyProduction: data.get('dailyProduction'), rejectWater: data.get('rejectWater'), lossPercentage: data.get('lossPercentage'), filledWater: data.get('filledWater'), carsCount: data.get('carsCount'), averagePerCar: data.get('averagePerCar'), notes: data.get('waterNotes') },
      tests: { phAfterDesalination: data.get('phAfter'), phWellWater: data.get('phWell'), tdsDesalinated: data.get('tdsFiltered'), tdsWell: data.get('tdsWell'), tdsReject: data.get('tdsReject'), freeChlorine: data.get('freeChlorine'), extraFields: [] },
      beneficiaries
    };
    return window.ReportUtils.recalc(report);
  }

  function addBeneficiary() {
    state.draft = collectSafeDraft();
    state.draft.beneficiaries.push({ id: `b-${Date.now()}`, name: '', quantity: '', cars: '', notes: '' });
    refreshForm('beneficiaries');
  }

  function addBeneficiaryTemplate(name) {
    state.draft = collectSafeDraft();
    if (!state.draft.beneficiaries.some(item => item.name === name)) {
      state.draft.beneficiaries.push({ id: `tpl-${Date.now()}`, name, quantity: '', cars: '', notes: '' });
    }
    refreshForm('beneficiaries');
  }

  function applyBeneficiaryTemplates() {
    state.draft = reportWithTemplateBeneficiaries(collectSafeDraft(), true);
    refreshForm('beneficiaries');
    toast('تمت تعبئة الجهات الافتراضية', 'ok');
  }

  function clearBeneficiaryAmounts() {
    state.draft = collectSafeDraft();
    state.draft.beneficiaries = state.draft.beneficiaries.map(item => ({ ...item, quantity: '', cars: '', notes: item.notes || '' }));
    refreshForm('beneficiaries');
  }

  async function removeBeneficiary(index) {
    const ok = await confirmDialog({ title: 'حذف جهة', message: 'سيتم حذف هذه الجهة من التقرير الحالي فقط.', confirmText: 'حذف', cancelText: 'إلغاء', danger: true });
    if (!ok) return;
    state.draft = collectSafeDraft();
    state.draft.beneficiaries.splice(index, 1);
    refreshForm('beneficiaries');
    toast('تم حذف الجهة من النموذج', 'ok');
  }

  function refreshForm(tab = 'general') {
    document.getElementById('formHost').innerHTML = window.AppUI.reportForm(state.draft, state.settings);
    bindTabs();
    document.querySelector(`[data-tab="${tab}"]`)?.click();
  }

  function collectSafeDraft() {
    try { return collectForm(); } catch { return state.draft || window.ReportUtils.emptyReport(); }
  }

  function buildSmartWarnings(report) {
    const r = window.ReportUtils.recalc(report);
    const warnings = new Set(r.warnings || []);
    const sameDate = state.reports.find(item => item.reportDate === r.reportDate && item.id !== state.editingId);
    if (sameDate) warnings.add('يوجد تقرير محفوظ بنفس التاريخ. تأكد أنك لا تكرر نفس اليوم.');
    const start = r.generator?.periods?.[0]?.startTime;
    const stop = r.generator?.periods?.[0]?.stopTime;
    if (!start || !stop) warnings.add('وقت تشغيل أو إيقاف المولد غير مكتمل.');
    if (!r.fuel?.consumedDaily) warnings.add('قيمة الوقود المستهلك فارغة.');
    if (!r.beneficiaries?.length) warnings.add('لا توجد جهات مستفيدة داخل التقرير.');
    if (r.beneficiaries?.some(item => item.name && (!item.quantity || !item.cars))) warnings.add('بعض الجهات لديها اسم بدون كمية أو عدد سيارات.');
    const calculatedFilled = r.beneficiaries.reduce((sum, item) => sum + window.ReportUtils.number(item.quantity), 0);
    if (calculatedFilled !== window.ReportUtils.number(r.water.filledWater)) warnings.add('إجمالي المياه المحسوب من الجهات لا يطابق حقل المياه المعبأة.');
    const prev = window.ReportUtils.number(r.fuel.previousBalance);
    const added = window.ReportUtils.number(r.fuel.addedDaily) + window.ReportUtils.number(r.fuel.municipalSupplied);
    const consumed = window.ReportUtils.number(r.fuel.consumedDaily);
    const current = window.ReportUtils.number(r.fuel.currentBalance);
    if ((prev || added || consumed || current) && current && Math.abs((prev + added - consumed) - current) > 1) warnings.add('رصيد الوقود الحالي لا يطابق معادلة الرصيد السابق + المضاف - المستهلك.');
    return [...warnings];
  }

  async function saveReport() {
    try {
      let report = collectForm();
      const smartWarnings = buildSmartWarnings(report);
      report.warnings = [...new Set([...(report.warnings || []), ...smartWarnings])];
      const message = smartWarnings.length ? `تم اكتشاف التنبيهات التالية قبل الحفظ:\n\n- ${smartWarnings.join('\n- ')}\n\nهل تريد الحفظ رغم ذلك؟` : 'هل تريد حفظ التقرير في قاعدة البيانات؟';
      const ok = await confirmDialog({ title: smartWarnings.length ? 'تنبيه ذكي قبل الحفظ' : (state.editingId ? 'حفظ التعديل' : 'حفظ التقرير'), message, confirmText: smartWarnings.length ? 'حفظ رغم التنبيهات' : 'حفظ', cancelText: 'مراجعة', danger: smartWarnings.length > 0 });
      if (!ok) return;
      const id = await window.FirebaseService.saveReport(report, state.user, state.editingId);
      state.currentId = id;
      closeModal();
      toast('تم حفظ التقرير بنجاح', 'ok');
    } catch (error) {
      toast('تعذر حفظ التقرير في Firestore', 'warn');
      console.error(error);
    }
  }

  async function deleteReport(id) {
    const ok = await confirmDialog({ title: 'حذف التقرير', message: 'سيتم حذف التقرير نهائيًا من قاعدة البيانات. هل أنت متأكد؟', confirmText: 'حذف نهائي', cancelText: 'إلغاء', danger: true });
    if (!ok) return;
    try {
      await window.FirebaseService.deleteReport(id, state.user);
      state.currentId = null;
      toast('تم حذف التقرير', 'ok');
    } catch (error) {
      toast('تعذر حذف التقرير', 'warn');
      console.error(error);
    }
  }

  async function copyWhatsApp(id) {
    const report = state.reports.find(item => item.id === id);
    if (!report) return;
    const text = window.ReportUtils.whatsappText(report);
    await navigator.clipboard.writeText(text);
    toast('تم نسخ نص التقرير وفتح واتساب', 'ok');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  function exportPdf(id) {
    const report = state.reports.find(item => item.id === id);
    if (!report) return;
    const w = window.open('', '_blank');
    w.document.write(`<html lang="ar" dir="rtl"><head><title>${report.title}</title><style>body{font-family:Tahoma,Arial;direction:rtl;padding:32px;line-height:1.9}pre{white-space:pre-wrap;font-size:15px}.footer{margin-top:30px;color:#666;border-top:1px solid #ddd;padding-top:10px}</style></head><body><pre>${window.AppUI.esc(window.ReportUtils.whatsappText(report))}</pre><div class="footer">تم توليد التقرير: ${new Date().toLocaleString('ar')}</div><script>print()<\/script></body></html>`);
    w.document.close();
    toast('تم تجهيز ملف PDF للطباعة', 'ok');
  }

  function workbookForReports(reports) {
    const wb = XLSX.utils.book_new();
    const general = reports.map(r => ({ 'التاريخ': r.reportDate, 'العنوان': r.title, 'المحطة': r.stationName, 'البئر': r.wellName, 'المشغل': r.operatorName }));
    const generator = reports.map(r => ({ 'التاريخ': r.reportDate, 'البداية': r.generator?.periods?.[0]?.startTime, 'الإيقاف': r.generator?.periods?.[0]?.stopTime, 'الساعات': r.generator?.totalRunHours, 'الحالة': r.generator?.status }));
    const fuel = reports.map(r => ({ 'التاريخ': r.reportDate, 'مضاف': r.fuel?.addedDaily, 'مستهلك': r.fuel?.consumedDaily, 'مورد من البلدية': r.fuel?.municipalSupplied, 'رصيد سابق': r.fuel?.previousBalance, 'رصيد حالي': r.fuel?.currentBalance, 'فاقد': r.fuel?.loss }));
    const water = reports.map(r => ({ 'التاريخ': r.reportDate, 'إنتاج الغاطس': r.water?.submersibleRate, 'بعد الفلترة': r.water?.filteredRate, 'الإنتاج': r.water?.dailyProduction, 'العادم': r.water?.rejectWater, 'نسبة الفاقد': r.water?.lossPercentage, 'المعبأ': r.water?.filledWater, 'السيارات': r.water?.carsCount, 'متوسط السيارة': r.water?.averagePerCar }));
    const tests = reports.map(r => ({ 'التاريخ': r.reportDate, 'PH بعد التحلية': r.tests?.phAfterDesalination, 'PH الغاطس': r.tests?.phWellWater, 'TDS محلاة': r.tests?.tdsDesalinated, 'TDS بئر': r.tests?.tdsWell, 'TDS عادم': r.tests?.tdsReject, 'الكلور الحر': r.tests?.freeChlorine }));
    const beneficiaries = reports.flatMap(r => (r.beneficiaries || []).map(b => ({ 'التاريخ': r.reportDate, 'الجهة': b.name, 'الكمية': b.quantity, 'السيارات': b.cars, 'ملاحظات': b.notes })));
    const s = window.ReportUtils.summary(reports);
    const summary = [{ 'إجمالي ساعات التشغيل': s.runHours, 'إجمالي الوقود المستهلك': s.fuelConsumed, 'إجمالي الوقود المورد': s.fuelSupplied, 'إجمالي الإنتاج': s.waterProduction, 'إجمالي العادم': s.rejectWater, 'إجمالي المعبأ': s.filledWater, 'إجمالي السيارات': s.cars, 'متوسط الإنتاج اليومي': s.averageDailyProduction, 'نسبة الفاقد': s.lossPercentage }];
    [['General', general], ['Generator', generator], ['Fuel', fuel], ['Water Quantities', water], ['Water Tests', tests], ['Beneficiaries', beneficiaries], ['Summary', summary]].forEach(([name, rows]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name));
    return wb;
  }

  function exportOneExcel(id) {
    const report = state.reports.find(item => item.id === id);
    if (!report) return;
    XLSX.writeFile(workbookForReports([report]), `${report.title}.xlsx`);
    toast('تم تصدير التقرير إلى Excel', 'ok');
  }

  function exportAllExcel() {
    XLSX.writeFile(workbookForReports(state.reports), 'تقارير تشغيل وضخ المياه.xlsx');
    toast('تم تصدير جميع التقارير إلى Excel', 'ok');
  }

  function openSummary() {
    const s = window.ReportUtils.summary(state.reports);
    confirmDialog({ title: 'ملخص التقارير', message: `ساعات التشغيل: ${s.runHours.toFixed(1)}\nالوقود المستهلك: ${s.fuelConsumed}\nالمياه المعبأة: ${s.filledWater}\nعدد السيارات: ${s.cars}\nنسبة الفاقد: ${s.lossPercentage}%`, confirmText: 'تم', cancelText: 'إغلاق' });
  }

  function goHome() { document.getElementById('top')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function goReports() { document.getElementById('reports')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  function openSettings() {
    render();
    document.getElementById('settingsModal')?.classList.add('open');
  }
  function closeSettings() { document.getElementById('settingsModal')?.classList.remove('open'); }

  async function saveSettings() {
    const form = document.getElementById('settingsForm');
    const data = new FormData(form);
    const next = {
      defaultStationName: data.get('defaultStationName') || DEFAULT_SETTINGS.defaultStationName,
      defaultWellName: data.get('defaultWellName') || DEFAULT_SETTINGS.defaultWellName,
      defaultOperatorName: data.get('defaultOperatorName') || '',
      defaultGeneratorStatus: data.get('defaultGeneratorStatus') || 'يعمل',
      submersibleRate: data.get('submersibleRate') || '',
      filteredRate: data.get('filteredRate') || '',
      rejectRate: data.get('rejectRate') || '',
      freeChlorine: data.get('freeChlorine') || '',
      beneficiaries: String(data.get('beneficiaries') || '').split('\n').map(x => x.trim()).filter(Boolean)
    };
    state.settings = { ...DEFAULT_SETTINGS, ...next };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    try {
      if (window.firebase?.firestore && state.user) {
        await firebase.firestore().collection('settings').doc('main').set({ ...state.settings, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      }
      toast('تم حفظ الإعدادات الافتراضية', 'ok');
    } catch (error) {
      toast('تم الحفظ محليًا فقط، تعذر حفظ Firestore', 'warn');
    }
    closeSettings();
    render();
  }

  async function resetSettings() {
    const ok = await confirmDialog({ title: 'استرجاع الإعدادات', message: 'سيتم استرجاع القيم الافتراضية للجهات والحقول.', confirmText: 'استرجاع', cancelText: 'إلغاء' });
    if (!ok) return;
    state.settings = { ...DEFAULT_SETTINGS };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    closeSettings();
    render();
    toast('تم استرجاع الإعدادات الافتراضية', 'ok');
  }

  return { start, login, logout, render, select, openNew, duplicateLastReport, openEdit, closeModal, togglePaste, parseText, addBeneficiary, addBeneficiaryTemplate, applyBeneficiaryTemplates, clearBeneficiaryAmounts, removeBeneficiary, saveReport, deleteReport, copyWhatsApp, exportPdf, exportOneExcel, exportAllExcel, openSummary, goHome, goReports, openSettings, closeSettings, saveSettings, resetSettings };
})();

window.addEventListener('DOMContentLoaded', () => window.App.start());
