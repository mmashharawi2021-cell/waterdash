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
    const latestFuel = [...list]
      .filter(r => n(r?.fuel?.currentBalance) > 0)
      .sort((a, b) => String(b.reportDate || '').localeCompare(String(a.reportDate || '')))[0];
    const data = list.reduce((acc, r) => {
      acc.runHours += hours(r?.generator?.totalRunHours);
      acc.fuelConsumed += n(r?.fuel?.consumedDaily);
      acc.fuelSupplied += n(r?.fuel?.addedDaily) + n(r?.fuel?.municipalSupplied);
      acc.waterProduction += n(r?.water?.dailyProduction);
      acc.rejectWater += n(r?.water?.rejectWater);
      acc.filledWater += n(r?.water?.filledWater);
      acc.cars += n(r?.water?.carsCount);
      return acc;
    }, { runHours: 0, fuelConsumed: 0, fuelSupplied: 0, waterProduction: 0, rejectWater: 0, filledWater: 0, cars: 0 });
    data.lossPercentage = data.waterProduction ? (data.rejectWater / data.waterProduction) * 100 : 0;
    data.stock = latestFuel ? n(latestFuel.fuel?.currentBalance) : 0;
    data.stockDate = latestFuel?.reportDate || '';
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

  function kpi(icon, label, value, hint = '') {
    return `<article class="kpi-card"><div class="kpi-icon">${icon}</div><span>${esc(label)}</span><strong>${esc(value)}</strong>${hint ? `<small>${esc(hint)}</small>` : ''}</article>`;
  }

  function card(report, activeId) {
    const r = window.ReportUtils?.recalc ? window.ReportUtils.recalc(report) : report;
    const date = window.ReportUtils?.displayDate ? window.ReportUtils.displayDate(r.reportDate) : (r.reportDate || '-');
    const warnings = Array.isArray(r.warnings) ? r.warnings.length : 0;
    const badge = warnings ? `<b class="card-badge warn">${warnings} تنبيه</b>` : `<b class="card-badge ok">مكتمل</b>`;
    return `<button class="report-card ${r.id === activeId ? 'active' : ''}" onclick="App.select('${esc(r.id)}')"><span>${date} ${badge}</span><strong>${esc(r.title || 'تقرير تشغيل وضخ المياه')}</strong><small>${esc(r.stationName || '-')} • تشغيل ${esc(r.generator?.totalRunHours || '-')} • وقود ${fmt(n(r.fuel?.consumedDaily))} لتر</small><em>${fmt(n(r.water?.filledWater))} كوب معبأ • ${fmt(n(r.water?.carsCount), 0)} سيارة</em></button>`;
  }

  function detail(report) {
    if (!report) {
      return `<section id="reportDetails" class="details empty-state details-placeholder"><div class="empty-icon">📄</div><h2>اختر تقريرًا من الكروت</h2><p>عند الضغط على أي كرت ستظهر تفاصيله هنا.</p></section>`;
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

  function bottomNav() {
    return `<nav class="bottom-nav">${button('viewReports', `<button onclick="App.goHome()"><span>🏠</span><b>الرئيسية</b></button>`)}${button('viewReports', `<button onclick="App.goReports()"><span>📋</span><b>التقارير</b></button>`)}${button('createReports', `<button class="main" onclick="App.openNew()"><span>＋</span><b>إضافة</b></button>`)}<button onclick="App.openSummary()"><span>📈</span><b>الإحصائيات</b></button>${button('manageSettings', `<button onclick="App.openSettings()"><span>⚙️</span><b>الإعدادات</b></button>`)}</nav>`;
  }

  function stableLayout(state, settings = {}) {
    const reports = (state?.reports || []).map(r => window.ReportUtils?.recalc ? window.ReportUtils.recalc(r) : r);
    const active = reports.find(r => r.id === state?.currentId) || null;
    const s = summary(reports);
    const user = window.AuthUsers?.currentUser?.();
    const userBadge = user ? `<div class="current-user-badge"><span>${esc(user.fullName)}</span><b>${esc(user.roleLabel || user.role)}</b></div>` : '';
    const heroButtons = [
      button('createReports', `<button class="btn primary big action-float" onclick="App.openNew()">➕ إضافة تقرير جديد</button>`),
      button('createReports', `<button class="btn action-float" onclick="App.duplicateLastReport()">⧉ تكرار آخر تقرير</button>`),
      `<button class="btn" onclick="App.openSummary()">📈 تقارير تجميعية</button>`,
      button('exportExcel', `<button class="btn" onclick="App.exportAllExcel()">📊 Excel شامل</button>`),
      button('manageUsers', `<button class="btn" onclick="UsersUI.open()">👥 المستخدمون</button>`),
      button('manageSettings', `<button class="btn" onclick="App.openSettings()">⚙️ الإعدادات</button>`),
      `<button class="btn ghost" onclick="App.logout()">🚪 خروج</button>`
    ].join('');
    return `<main class="app-shell"><header id="top" class="hero"><div><p class="eyebrow">لوحة التشغيل</p><h1>نظام تقارير تشغيل وضخ المياه</h1><p>منصة يومية رسمية للتشغيل، الوقود، الإنتاج، الفحوصات، الجهات المستفيدة، والأرشفة.</p></div><div class="hero-actions">${heroButtons}</div>${userBadge}</header><section class="stats dashboard-totals"><article class="kpi-wide"><div class="kpi-head"><span>ملخص التشغيل</span><b>${reports.length} تقرير</b></div><strong>${fmt(s.runHours, 1)}</strong><small>إجمالي ساعات التشغيل</small></article>${kpi('⛽','وقود مستهلك',fmt(s.fuelConsumed),'لتر')}${kpi('📦','السولار في المخزون',s.stock ? fmt(s.stock) : '_',s.stockDate ? `آخر رصيد بتاريخ ${window.ReportUtils?.displayDate ? window.ReportUtils.displayDate(s.stockDate) : s.stockDate}` : 'لا يوجد رصيد')}${kpi('⛽','إجمالي السولار المستلم',fmt(s.fuelSupplied),'المضاف + المورد')}${kpi('💧','مياه معبأة',fmt(s.filledWater),'كوب')}${kpi('🚚','عدد السيارات',fmt(s.cars,0),'سيارة')}${kpi('🏭','إجمالي الإنتاج',fmt(s.waterProduction),'كوب')}${kpi('♻️','العادم',fmt(s.rejectWater),'كوب')}${kpi('📉','نسبة الفاقد',`${fmt(s.lossPercentage)}%`,'محسوبة تلقائيًا')}${kpi('🧪','فحوصات',reports.length,'سجل يومي')}</section><section id="reports" class="cards-section"><div class="section-head"><div><p class="eyebrow">الأرشيف</p><h2>كروت التقارير</h2></div></div><div class="cards reports-grid">${reports.map(r => card(r, active?.id)).join('') || '<div class="empty-mini">لا توجد تقارير محفوظة.</div>'}</div></section>${detail(active)}<div class="bottom-space"></div>${reportModal()}${settingsModal(settings)}${usersModal()}${bottomNav()}</main>`;
  }

  function patch() {
    if (!window.AppUI) return;
    window.AppUI.layout = stableLayout;
    window.AppUI.__layoutResetPatched = true;
  }

  patch();
  window.addEventListener('DOMContentLoaded', patch);
})();
