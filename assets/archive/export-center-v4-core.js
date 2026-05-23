(()=>{
  const CATS={reports:['📋','التقارير'],fuel:['⛽','الوقود'],water:['💧','المياه'],beneficiaries:['🚚','الجهات']};
  const TYPES={
    allReports:{cat:'reports',label:'كل التقارير',desc:'تصدير جميع التقارير ضمن فترة'},dailyFull:{cat:'reports',label:'تقرير يومي شامل',desc:'تقرير ليوم محدد'},monthlyFull:{cat:'reports',label:'تقرير شهري شامل',desc:'كل بيانات شهر محدد'},monthlyShort:{cat:'reports',label:'تقرير شهري مختصر',desc:'ملخص أرقام الشهر'},customReport:{cat:'reports',label:'تقرير مخصص',desc:'حسب الفترة'},
    incomingFuel:{cat:'fuel',label:'الوقود الوارد',desc:'سجلات الوقود الوارد'},consumedFuel:{cat:'fuel',label:'الوقود المستهلك',desc:'من التقارير اليومية'},fuelSummary:{cat:'fuel',label:'ملخص الوقود',desc:'وارد ومستهلك وصافي'},
    producedWater:{cat:'water',label:'المياه المنتجة',desc:'الإنتاج والعادم والفاقد'},deliveredWater:{cat:'water',label:'المياه المعبأة',desc:'الكميات المسلمة للجهات'},
    beneficiaries:{cat:'beneficiaries',label:'كل الجهات',desc:'كل الجهات المستفيدة'},beneficiaryOne:{cat:'beneficiaries',label:'جهة محددة',desc:'فلترة باسم جهة'}
  };
  const S={cat:'reports',type:'allReports',rows:[],summary:{}};
  const today=()=>new Date().toISOString().slice(0,10);
  const ym=()=>today().slice(0,7);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  function loadCss(){if(document.querySelector('link[href*="export-center-v4.css"]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='assets/export-center-v4.css?v='+(window.WATER_APP_BUILD||Date.now());document.head.appendChild(l)}
  function status(m,c=''){const e=document.getElementById('exportV4Status');if(e){e.className='export-v4-status '+c;e.textContent=m}}
  function showFilters(){document.querySelectorAll('.ev4-range,.ev4-day,.ev4-month,.ev4-ben').forEach(e=>e.classList.add('hidden'));if(S.type==='dailyFull')document.querySelectorAll('.ev4-day').forEach(e=>e.classList.remove('hidden'));else if(['monthlyFull','monthlyShort'].includes(S.type))document.querySelectorAll('.ev4-month').forEach(e=>e.classList.remove('hidden'));else document.querySelectorAll('.ev4-range').forEach(e=>e.classList.remove('hidden'));if(S.type==='beneficiaryOne')document.querySelectorAll('.ev4-ben').forEach(e=>e.classList.remove('hidden'))}
  function render(){loadCss();let sec=document.getElementById('exportCenterSection');if(!sec){const a=document.getElementById('incomingFuelSection')||document.querySelector('.stats.dashboard-totals');sec=document.createElement('section');sec.id='exportCenterSection';a?.insertAdjacentElement('afterend',sec)}sec.className='export-v4';sec.style.display='block';sec.innerHTML=`<div class="export-v4-head"><div><p class="eyebrow">مركز التصدير الجديد</p><h2>تصدير البيانات بخطوات واضحة</h2><p>اختر نوع التصدير، راجع النتائج، ثم صدّر Excel أو PDF. لا يتم إنشاء ملفات فارغة.</p></div><button class="export-v4-close" type="button" onclick="ExportV4.close()">×</button></div><div class="export-v4-quick"><button data-q="dailyFull">تقرير اليوم<small>أسرع تصدير يومي</small></button><button data-q="monthlyFull">تقرير هذا الشهر<small>شامل</small></button><button data-q="incomingFuel">وقود هذا الشهر<small>الوارد</small></button><button data-q="beneficiaries">جهات هذا الشهر<small>المستفيدون</small></button></div><div class="export-v4-steps"><section class="export-v4-step"><div class="export-v4-step-title"><h3>1) اختر القسم</h3><b>1</b></div><div class="export-v4-categories">${Object.entries(CATS).map(([id,v])=>`<button class="export-v4-card ${S.cat===id?'active':''}" data-cat="${id}"><span>${v[0]}</span><strong>${v[1]}</strong></button>`).join('')}</div></section><section class="export-v4-step"><div class="export-v4-step-title"><h3>2) اختر نوع التقرير</h3><b>2</b></div><div class="export-v4-types">${Object.entries(TYPES).filter(([,t])=>t.cat===S.cat).map(([id,t])=>`<button class="export-v4-type ${S.type===id?'active':''}" data-type="${id}">${t.label}<small>${t.desc}</small></button>`).join('')}</div></section><section class="export-v4-step"><div class="export-v4-step-title"><h3>3) الفلاتر والمعاينة</h3><b>3</b></div><form id="exportV4Form" class="export-v4-filters"><label class="ev4-range">من تاريخ<input name="from" type="date"></label><label class="ev4-range">إلى تاريخ<input name="to" type="date" value="${today()}"></label><label class="ev4-day">اليوم<input name="day" type="date" value="${today()}"></label><label class="ev4-month">الشهر<input name="month" type="month" value="${ym()}"></label><label class="ev4-ben">اسم الجهة<input name="beneficiary" placeholder="مثال: بلدية بيت لاهيا"></label><label>ملاحظة الملف<input name="note" placeholder="اختياري"></label></form><div class="export-v4-actions"><button type="button" class="export-v4-primary" onclick="ExportV4.preview()">معاينة النتائج</button><button type="button" class="export-v4-secondary" onclick="ExportV4.reset()">إعادة ضبط</button></div><div id="exportV4Status" class="export-v4-status">جاهز للمعاينة.</div></section><section class="export-v4-step"><div class="export-v4-step-title"><h3>4) النتائج والتصدير</h3><b>4</b></div><div id="exportV4Preview" class="export-v4-preview"><p class="muted">اضغط معاينة النتائج أولًا.</p></div></section></div>`;bind();showFilters();setTimeout(()=>sec.scrollIntoView({behavior:'smooth',block:'start'}),70)}
  function bind(){document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{S.cat=b.dataset.cat;const first=Object.entries(TYPES).find(([,t])=>t.cat===S.cat);S.type=first?first[0]:'allReports';render()});document.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{S.type=b.dataset.type;render()});document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{S.type=b.dataset.q;S.cat=TYPES[S.type].cat;render()})}
  function close(){const s=document.getElementById('exportCenterSection');if(s)s.style.display='none'}
  function reset(){S.cat='reports';S.type='allReports';S.rows=[];render()}
  function open(){render()}
  window.ExportV4={open,close,reset,render,preview:()=>window.ExportV4Runner?.preview(),state:S,types:TYPES,esc,status,today,ym};
  if(window.WaterFuel)window.WaterFuel.openExportCenter=open;
  // ربط صريح عند DOMContentLoaded وعند load
  function bindWaterFuel() {
    if (window.WaterFuel) {
      window.WaterFuel.openExportCenter = open;
      window.WaterFuel.closeExportCenter = close;
      window.WaterFuel.executeExport = open;
    }
  }
  window.addEventListener('DOMContentLoaded', bindWaterFuel);
  window.addEventListener('load', bindWaterFuel);
  // تأكد بعد 500ms و 1500ms بعد أن تتم التهيئة
  setTimeout(bindWaterFuel, 500);
  setTimeout(bindWaterFuel, 1500);
})();