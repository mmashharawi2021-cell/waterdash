/* --- Auto-Generated Module: main-app.js --- */

/* ==========================================
   FILE: stable-cleanup.js
   ========================================== */
(() => {
  const EXTERNAL_WATER_RE = /مياه خارجية|صنابير للمواطنين|خارج المحطة/;

  function number(value) {
    if (window.ReportUtils?.number) return window.ReportUtils.number(value);
    const n = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  function cleanNumber(value, digits = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return value === 0 ? 0 : '';
    const rounded = +n.toFixed(digits);
    return Number.isInteger(rounded) ? rounded : rounded;
  }

  function isExternalWater(name) {
    return EXTERNAL_WATER_RE.test(String(name || ''));
  }

  function cleanBeneficiaries(report) {
    const next = structuredClone(report || {});
    next.beneficiaries = Array.isArray(next.beneficiaries) ? next.beneficiaries.map(item => {
      if (!isExternalWater(item.name)) return item;
      return { ...item, cars: '0' };
    }) : [];
    return next;
  }

  function cleanReport(report) {
    const r = cleanBeneficiaries(report || {});
    r.fuel = r.fuel || {};
    const prev = number(r.fuel.previousBalance);
    const added = number(r.fuel.addedDaily);
    const municipal = number(r.fuel.municipalSupplied);
    const current = number(r.fuel.currentBalance);

    // لا نعرض ولا نعتمد رصيدًا سالبًا ناتجًا عن تقرير ناقص أو بدون رصيد سابق.
    if (prev < 0) r.fuel.previousBalance = '';
    if (current < 0 && !prev && !added && !municipal) {
      r.fuel.currentBalance = '';
      r.fuel.loss = '';
    }
    return r;
  }

  function patchReportUtils() {
    if (!window.ReportUtils || window.ReportUtils.__stableCleanupPatched) return;
    const originalRecalc = window.ReportUtils.recalc;
    const originalSummary = window.ReportUtils.summary;

    window.ReportUtils.recalc = function stableRecalc(report) {
      const r = originalRecalc(cleanReport(report));
      r.fuel = r.fuel || {};
      r.water = r.water || {};

      ['addedDaily', 'consumedDaily', 'municipalSupplied', 'previousBalance', 'currentBalance', 'loss'].forEach(key => {
        if (r.fuel[key] !== '' && r.fuel[key] != null) r.fuel[key] = cleanNumber(number(r.fuel[key]));
      });
      ['submersibleRate', 'filteredRate', 'dailyProduction', 'rejectWater', 'lossPercentage', 'filledWater', 'carsCount', 'averagePerCar'].forEach(key => {
        if (r.water[key] !== '' && r.water[key] != null) r.water[key] = cleanNumber(number(r.water[key]));
      });

      r.beneficiaries = (r.beneficiaries || []).map(item => isExternalWater(item.name) ? { ...item, cars: '0' } : item);
      r.warnings = (r.warnings || []).filter(w => !(String(w).includes('بعض الجهات') && r.beneficiaries.every(item => !isExternalWater(item.name) || String(item.cars) === '0')));
      return r;
    };

    window.ReportUtils.summary = function stableSummary(reports) {
      const s = originalSummary((reports || []).map(cleanReport));
      return Object.fromEntries(Object.entries(s).map(([key, value]) => [key, typeof value === 'number' ? cleanNumber(value) : value]));
    };

    window.ReportUtils.__stableCleanupPatched = true;
  }

  function patchLayout() {
    if (!window.AppUI || window.AppUI.__stableLayoutPatched) return;
    const previousLayout = window.AppUI.layout;
    window.AppUI.layout = function stableLayout(state, settings) {
      const cleanState = {
        ...state,
        reports: (state?.reports || []).map(report => window.ReportUtils?.recalc ? window.ReportUtils.recalc(report) : cleanReport(report))
      };
      return previousLayout(cleanState, settings);
    };
    window.AppUI.__stableLayoutPatched = true;
  }

  function fixExternalWaterRows() {
    document.querySelectorAll('#beneficiariesRows tr').forEach(row => {
      const name = row.querySelector('[data-b="name"]')?.value || '';
      const cars = row.querySelector('[data-b="cars"]');
      if (!cars) return;
      if (isExternalWater(name)) {
        cars.value = '0';
        cars.readOnly = true;
        row.classList.add('external-water-row');
        const cell = cars.closest('td');
        if (cell && !cell.querySelector('.external-water-note')) {
          cell.insertAdjacentHTML('beforeend', '<span class="external-water-note">لا يوجد سيارات</span>');
        }
      }
    });
  }

  function moveReportActionsToTop() {
    const modal = document.getElementById('reportModal');
    if (!modal?.classList.contains('open')) return;
    const panel = modal.querySelector('.modal-panel.large');
    const title = modal.querySelector('.modal-title');
    const actions = modal.querySelector('.modal-actions');
    if (!panel || !title || !actions || actions.dataset.movedTop === 'true') return;
    title.insertAdjacentElement('afterend', actions);
    actions.dataset.movedTop = 'true';
  }

  function fixLiveFuelBalance() {
    const form = document.getElementById('reportForm');
    if (!form) return;
    const current = form.querySelector('[name="fuelCurrent"]');
    const loss = form.querySelector('[name="fuelLoss"]');
    const prev = number(form.querySelector('[name="fuelPrevious"]')?.value);
    const added = number(form.querySelector('[name="fuelAdded"]')?.value);
    const municipal = number(form.querySelector('[name="fuelMunicipal"]')?.value);
    const currentVal = number(current?.value);
    if (current && currentVal < 0 && !prev && !added && !municipal) {
      current.value = '';
      current.dataset.autoCalculated = 'true';
      if (loss) loss.value = '';
    }
  }

  function applyDomCleanup() {
    moveReportActionsToTop();
    fixExternalWaterRows();
    fixLiveFuelBalance();
  }

  function patchAll() {
    patchReportUtils();
    patchLayout();
    applyDomCleanup();
  }

  patchAll();
  window.addEventListener('DOMContentLoaded', () => {
    patchAll();
    const observer = new MutationObserver(applyDomCleanup);
    observer.observe(document.body, { childList: true, subtree: true });
    document.body.addEventListener('input', applyDomCleanup, true);
    document.body.addEventListener('change', applyDomCleanup, true);
  });
})();


/* ==========================================
   FILE: app.js
   ========================================== */
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
  const state = {
    user: null,
    settings: { ...DEFAULT_SETTINGS },
    reports: [],
    draft: null,
    currentId: null,
    editingId: null,
    uiFilter: 'all',
    view: 'home',
    formStep: 1,
    sidebarPinned: localStorage.getItem('sidebarPinned') === 'true'
  };

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

  function setUIFilter(filter) {
    state.uiFilter = filter;
    render();
  }

  function getUIFilter() {
    return state.uiFilter || 'all';
  }

  function render() {
    // Sort logic
    state.reports = [...state.reports].sort((a, b) => b.reportDate.localeCompare(a.reportDate));

    if (!state.user) {
      setHtml(window.AppUI.login(window.firebase?.firestore));
      return;
    }
    setHtml(window.AppUI.layout(state, state.settings));
    bindTabs();
    window.LiveCalculations?.bind?.();
  }

  function toggleTheme() {
    if (!window.ThemeManager) return;
    const t = window.ThemeManager.current() === 'dark' ? 'light' : 'dark';
    window.ThemeManager.saveUserTheme(t);
  }

  async function hardRefresh() {
    const btn = document.getElementById('headerHardRefreshBtn');
    if (btn) btn.classList.add('is-loading');
    
    const el = document.createElement('div');
    el.className = 'hard-refresh-toast';
    el.textContent = 'جاري التحديث القوي...';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);

    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      }
    } catch (e) {}

    try {
      localStorage.setItem('waterAppForceRefreshAt', String(Date.now()));
    } catch {}

    const url = new URL(window.location.href);
    url.searchParams.set('r', String(Date.now()));
    window.location.replace(url.toString());
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
    r.water.lossPercentage = r.water.lossPercentage || state.settings.lossPercentage || '32.74';
    
    if (state.settings.defaultTests) {
      const testsRaw = String(state.settings.defaultTests).toUpperCase();
      if (!r.tests.tdsDesalinated) {
        const match = testsRaw.match(/TDS\s*:\s*(\d+)/);
        if (match) r.tests.tdsDesalinated = match[1];
      }
      if (!r.tests.phAfterDesalination) {
        const match = testsRaw.match(/PH\s*:\s*([\d.]+)/);
        if (match) r.tests.phAfterDesalination = match[1];
      }
    }
    
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
    state.view = 'form';
    state.formStep = 1;
    render();
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
    state.view = 'form';
    state.formStep = 1;
    render();
    toast('تم تجهيز نسخة من آخر تقرير بتاريخ اليوم', 'ok');
  }

  function openEdit(id) {
    const report = state.reports.find(item => item.id === id);
    if (!report) return;
    state.editingId = id;
    state.draft = window.ReportUtils.recalc(report);
    state.view = 'form';
    state.formStep = 1;
    render();
  }

  function closeModal() {
    state.view = 'reports';
    state.editingId = null;
    state.draft = null;
    render();
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
      const newId = await window.FirebaseService.saveReport(report, state.user, state.editingId);
      state.currentId = newId;
      closeModal();
      toast('تم حفظ التقرير بنجاح!', 'ok');
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

  function workbookForReports(reports, dataType = 'all') {
    const wb = XLSX.utils.book_new();
    const general = reports.map(r => ({ 'التاريخ': r.reportDate, 'العنوان': r.title, 'المحطة': r.stationName, 'البئر': r.wellName, 'المشغل': r.operatorName }));
    const generator = reports.map(r => ({ 'التاريخ': r.reportDate, 'البداية': r.generator?.periods?.[0]?.startTime, 'الإيقاف': r.generator?.periods?.[0]?.stopTime, 'الساعات': r.generator?.totalRunHours, 'الحالة': r.generator?.status }));
    const fuel = reports.map(r => ({ 'التاريخ': r.reportDate, 'مضاف': r.fuel?.addedDaily, 'مستهلك': r.fuel?.consumedDaily, 'مورد من البلدية': r.fuel?.municipalSupplied, 'رصيد سابق': r.fuel?.previousBalance, 'رصيد حالي': r.fuel?.currentBalance, 'فاقد': r.fuel?.loss }));
    const water = reports.map(r => ({ 'التاريخ': r.reportDate, 'إنتاج الغاطس': r.water?.submersibleRate, 'بعد الفلترة': r.water?.filteredRate, 'الإنتاج': r.water?.dailyProduction, 'العادم': r.water?.rejectWater, 'نسبة الفاقد': r.water?.lossPercentage, 'المعبأ': r.water?.filledWater, 'السيارات': r.water?.carsCount, 'متوسط السيارة': r.water?.averagePerCar }));
    const tests = reports.map(r => ({ 'التاريخ': r.reportDate, 'PH بعد التحلية': r.tests?.phAfterDesalination, 'PH الغاطس': r.tests?.phWellWater, 'TDS محلاة': r.tests?.tdsDesalinated, 'TDS بئر': r.tests?.tdsWell, 'TDS عادم': r.tests?.tdsReject, 'الكلور الحر': r.tests?.freeChlorine }));
    const beneficiaries = reports.flatMap(r => (r.beneficiaries || []).map(b => ({ 'التاريخ': r.reportDate, 'الجهة': b.name, 'الكمية': b.quantity, 'السيارات': b.cars, 'ملاحظات': b.notes })));
    const s = window.ReportUtils.summary(reports);
    const summary = [{ 'إجمالي ساعات التشغيل': s.runHours, 'إجمالي استهلاك الوقود': s.fuelConsumed, 'إجمالي المورد': s.fuelSupplied, 'إجمالي الإنتاج': s.waterProduction, 'إجمالي الفاقد': s.rejectWater, 'إجمالي المعبأة': s.filledWater, 'إجمالي السيارات': s.cars, 'متوسط الإنتاج اليومي': s.averageDailyProduction, 'نسبة الفاقد': s.lossPercentage }];
    
    let sheets = [['General', general], ['Generator', generator], ['Fuel', fuel], ['Water Quantities', water], ['Water Tests', tests], ['Beneficiaries', beneficiaries], ['Summary', summary]];
    
    if (dataType && dataType !== 'all') {
      sheets = sheets.filter(sheet => sheet[0] === dataType);
    }
    
    sheets.forEach(([name, rows]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name));
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



  function goHome() { state.view = 'home'; render(); }
  function goReports() { state.view = 'reports'; render(); }
  function goExport() { state.view = 'export'; render(); }
  
  function nextStep() {
    if (state.formStep < 6) {
      state.draft = collectSafeDraft();
      state.formStep++;
      render();
    }
  }

  function prevStep() {
    if (state.formStep > 1) {
      state.draft = collectSafeDraft();
      state.formStep--;
      render();
    }
  }

  function setStep(step) {
    state.draft = collectSafeDraft();
    state.formStep = step;
    render();
  }

  function toggleSidebar() {
    state.sidebarPinned = !state.sidebarPinned;
    localStorage.setItem('sidebarPinned', state.sidebarPinned);
    render();
  }

  function exportFilteredExcel() {
    const filtered = getFilteredReports();
    if (!filtered) return;
    const dataType = document.getElementById('exportDataType')?.value || 'all';
    XLSX.writeFile(workbookForReports(filtered, dataType), 'تقارير_مخصصة.xlsx');
    toast(`تم تصدير ${filtered.length} تقرير بنجاح`, 'ok');
  }

  function getFilteredReports() {
    const startDate = document.getElementById('exportStartDate')?.value;
    const endDate = document.getElementById('exportEndDate')?.value;
    const station = document.getElementById('exportStation')?.value;

    let filtered = [...state.reports];

    if (startDate) {
      filtered = filtered.filter(r => r.reportDate >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(r => r.reportDate <= endDate);
    }
    if (station) {
      filtered = filtered.filter(r => r.stationName === station);
    }

    if (filtered.length === 0) {
      toast('لا توجد تقارير تطابق هذه الشروط!', 'error');
      return null;
    }
    return filtered;
  }

  function getReportsText(filtered) {
    return filtered.map(r => window.ReportUtils.whatsappText(r)).join('\n\n========================\n\n');
  }

  async function exportFilteredWhatsApp() {
    const filtered = getFilteredReports();
    if (!filtered) return;
    const text = getReportsText(filtered);
    await navigator.clipboard.writeText(text).catch(()=>{});
    toast('تم نسخ النص إلى الحافظة وفتح واتساب', 'ok');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  function exportFilteredWord() {
    const filtered = getFilteredReports();
    if (!filtered) return;
    const html = `<html lang="ar" dir="rtl"><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; background: white; color: black; direction: rtl;">` + 
                 filtered.map(r => `<pre style="font-family: Tahoma, Arial, sans-serif; font-size: 15px; white-space: pre-wrap; direction: rtl;">${window.AppUI.esc(window.ReportUtils.whatsappText(r))}</pre>`).join('<hr style="border:1px solid #ccc; margin: 20px 0;">') + 
                 `</body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'تقارير_مخصصة.doc';
    a.click();
    toast('تم استخراج ملف Word بنجاح', 'ok');
  }

  function exportFilteredPDF() {
    const filtered = getFilteredReports();
    if (!filtered) return;
    const w = window.open('', '_blank');
    const html = `<html lang="ar" dir="rtl"><head><title>تقارير مخصصة</title><style>body{font-family:Tahoma,Arial;direction:rtl;padding:32px;line-height:1.9;background:white;color:black;}pre{white-space:pre-wrap;font-size:15px;font-family:Tahoma,Arial;}</style></head><body>` + 
                 filtered.map(r => `<pre>${window.AppUI.esc(window.ReportUtils.whatsappText(r))}</pre>`).join('<hr style="border:1px solid #eee;margin:30px 0;">') + 
                 `<script>setTimeout(()=>window.print(), 500);<\/script></body></html>`;
    w.document.write(html);
    w.document.close();
    toast('تم تجهيز التقرير للطباعة כـ PDF', 'ok');
  }

  function exportFilteredImage() {
    const filtered = getFilteredReports();
    if (!filtered) return;
    
    if (!window.html2canvas) {
      toast('جاري تحميل مكتبة معالجة الصور...', 'warn');
      return;
    }

    toast('جاري معالجة الصورة، يرجى الانتظار...', 'ok');
    
    const container = document.createElement('div');
    container.style.padding = '40px';
    container.style.background = 'white';
    container.style.color = 'black';
    container.style.width = '800px';
    container.style.fontFamily = 'Tahoma, Arial';
    container.style.direction = 'rtl';
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.innerHTML = filtered.map(r => `<pre style="white-space:pre-wrap; font-size: 16px; font-family: Tahoma, Arial;">${window.AppUI.esc(window.ReportUtils.whatsappText(r))}</pre>`).join('<hr style="border:1px dashed #ccc; margin: 30px 0;">');
    
    document.body.appendChild(container);

    html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'تقارير_مخصصة.png';
      a.click();
      document.body.removeChild(container);
      toast('تم حفظ الصورة بنجاح!', 'ok');
    }).catch(err => {
      document.body.removeChild(container);
      toast('فشل في إنشاء الصورة', 'error');
    });
  }

  function openSettings() {
    render();
    document.getElementById('settingsModal')?.classList.add('open');
  }
  function closeSettings() { document.getElementById('settingsModal')?.classList.remove('open'); }

  async function applySettingsToPastReports(scope, settings) {
    if (!state.reports || !state.reports.length) return;
    toast('جاري تحديث التقارير السابقة... الرجاء الانتظار', 'warn');
    
    const sorted = [...state.reports].sort((a, b) => String(a.reportDate).localeCompare(String(b.reportDate)));
    let previousFuelBalance = 0;
    
    for (let i = 0; i < sorted.length; i++) {
      let r = structuredClone(sorted[i]);
      
      const filteredRate = Number(settings.filteredRate) || Number(r.water?.filteredRate) || 0;
      const submersibleRate = Number(settings.submersibleRate) || Number(r.water?.submersibleRate) || 0;
      
      const [h, m=0] = String(r.generator?.totalRunHours || '0:0').split(':').map(Number);
      const decHours = (Number(h) || 0) + ((Number(m) || 0) / 60);

      if (!r.water) r.water = {};
      
      if (settings.filteredRate) r.water.filteredRate = settings.filteredRate;
      if (settings.submersibleRate) r.water.submersibleRate = settings.submersibleRate;
      if (settings.lossPercentage) r.water.lossPercentage = settings.lossPercentage;
      if (settings.carCapacity) r.water.averagePerCar = settings.carCapacity;
      
      if (decHours > 0 && filteredRate > 0) {
        const prod = filteredRate * decHours;
        r.water.dailyProduction = window.ReportUtils?.number ? window.ReportUtils.number(prod.toFixed(2)) : Number(prod.toFixed(2));
        const loss = Number(settings.lossPercentage) || 32.74;
        if (loss > 0 && loss < 100) {
           const lossFraction = loss / 100;
           const reject = prod * (lossFraction / (1 - lossFraction));
           r.water.rejectWater = window.ReportUtils?.number ? window.ReportUtils.number(reject.toFixed(2)) : Number(reject.toFixed(2));
        } else if (submersibleRate > filteredRate) {
           r.water.rejectWater = window.ReportUtils?.number ? window.ReportUtils.number(((submersibleRate - filteredRate) * decHours).toFixed(2)) : Number(((submersibleRate - filteredRate) * decHours).toFixed(2));
        }
      }

      if (!r.fuel) r.fuel = {};
      
      if (scope === 'past_with_fuel') {
        const fuelRate = Number(settings.fuelRate) || 19;
        if (decHours > 0) {
          const cons = decHours * fuelRate;
          r.fuel.consumedDaily = window.ReportUtils?.number ? window.ReportUtils.number(cons.toFixed(2)) : Number(cons.toFixed(2));
        }
        
        if (i > 0) {
           r.fuel.previousBalance = previousFuelBalance;
        }
        
        const prev = Number(r.fuel.previousBalance) || 0;
        const added = Number(r.fuel.addedDaily) || 0;
        const municipal = Number(r.fuel.municipalSupplied) || 0;
        const consumed = Number(r.fuel.consumedDaily) || 0;
        
        const current = prev + added + municipal - consumed;
        r.fuel.currentBalance = window.ReportUtils?.number ? window.ReportUtils.number(current.toFixed(2)) : Number(current.toFixed(2));
        
        previousFuelBalance = r.fuel.currentBalance;
      }
      
      if (window.ReportUtils?.recalc) r = window.ReportUtils.recalc(r);
      if (window.FirebaseService?.saveReport) await window.FirebaseService.saveReport(r, state.user, r.id);
    }
  }

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
      lossPercentage: data.get('lossPercentage') || '32.74',
      fuelRate: data.get('fuelRate') || '19',
      carCapacity: data.get('carCapacity') || '',
      defaultTests: data.get('defaultTests') || '',
      freeChlorine: data.get('freeChlorine') || '',
      beneficiaries: String(data.get('beneficiaries') || '').split('\n').map(x => x.trim()).filter(Boolean)
    };
    
    const applyScope = data.get('applyScope') || 'future';
    
    state.settings = { ...DEFAULT_SETTINGS, ...next };
    window.WATER_APP_SETTINGS = state.settings;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    
    try {
      if (window.firebase?.firestore && state.user) {
        await firebase.firestore().collection('settings').doc('main').set({ ...state.settings, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        if (applyScope !== 'future') {
          await applySettingsToPastReports(applyScope, state.settings);
        }
      }
      toast(applyScope !== 'future' ? 'تم حفظ الإعدادات وتحديث التقارير بنجاح' : 'تم حفظ الإعدادات الافتراضية', 'ok');
    } catch (error) {
      toast('تم الحفظ محليًا فقط، تعذر الحفظ عبر الشبكة', 'warn');
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

  return { start, login, logout, render, select, openNew, duplicateLastReport, openEdit, closeModal, togglePaste, parseText, addBeneficiary, addBeneficiaryTemplate, applyBeneficiaryTemplates, clearBeneficiaryAmounts, removeBeneficiary, saveReport, deleteReport, copyWhatsApp, exportPdf, exportOneExcel, exportAllExcel, exportFilteredExcel, exportFilteredWhatsApp, exportFilteredWord, exportFilteredPDF, exportFilteredImage, goHome, goReports, goExport, openSettings, closeSettings, saveSettings, resetSettings, setUIFilter, getUIFilter, nextStep, prevStep, setStep, toggleSidebar, toggleTheme, hardRefresh };
})();

window.addEventListener('DOMContentLoaded', () => window.App.start());


