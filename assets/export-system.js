/* --- Auto-Generated Module: export-system.js --- */

/* ==========================================
   FILE: export-center-v4-core.js
   ========================================== */
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

/* ==========================================
   FILE: export-center-v4-runner.js
   ========================================== */
(()=>{
function db(){if(!window.firebase?.firestore)throw Error('Firebase غير متاح');return firebase.firestore()}
function num(v){return window.ReportUtils?.number?window.ReportUtils.number(v):(Number(v)||0)}
function okDate(d,f,t){
  if(!d)return false;
  const norm = v => window.ReportUtils?.normalizeDateInput ? window.ReportUtils.normalizeDateInput(v) : String(v || '');
  const nd = norm(d), nf = norm(f), nt = norm(t);
  if(nf&&nd<nf)return false;
  if(nt&&nd>nt)return false;
  return true;
}
async function reports(){const s=await db().collection('reports').orderBy('reportDate','desc').get();return s.docs.map(d=>{const r={id:d.id,...d.data()};return window.ReportUtils?.recalc?window.ReportUtils.recalc(r):r;})}
async function fuels(){const s=await db().collection('fuelEntries').orderBy('date','desc').get();return s.docs.map(d=>{const a=d.data()||{};return{id:d.id,type:a.type||'incoming',date:a.date||'',day:a.day||'',time:a.time||'',supplier:a.supplier||a.donor||'',quantityLiters:a.quantityLiters??a.quantity??'',fillingMethod:a.fillingMethod||'',deliveredBy:a.deliveredBy||'',notes:a.notes||'',consumedFor:a.consumedFor||'',receivedBy:a.receivedBy||''}})}
function f(){return new FormData(document.getElementById('exportV4Form'))}
function filterReports(all,fd,type){
  const norm = v => window.ReportUtils?.normalizeDateInput ? window.ReportUtils.normalizeDateInput(v) : String(v || '');
  if(type==='dailyFull') {
    const qd = norm(fd.get('day'));
    return all.filter(r=>norm(r.reportDate)===qd);
  }
  if(type==='monthlyFull'||type==='monthlyShort') {
    const qm = String(fd.get('month')||'');
    return all.filter(r=>norm(r.reportDate).startsWith(qm));
  }
  return all.filter(r=>okDate(r.reportDate,String(fd.get('from')||'0000-01-01'),String(fd.get('to')||'9999-12-31')));
}
function filterFuels(all,fd){return all.filter(x=>okDate(x.date,String(fd.get('from')||'0000-01-01'),String(fd.get('to')||'9999-12-31')))}
function rows(type,reps,fls,fd){const ben=String(fd.get('beneficiary')||'').trim();if(type==='incomingFuel')return fls.filter(x=>x.type!=='consumed').map(x=>({'التاريخ':x.date,'اليوم':x.day,'الوقت':x.time,'المورد':x.supplier,'الكمية لتر':x.quantityLiters,'طريقة التعبئة':x.fillingMethod,'المسلّم':x.deliveredBy,'ملاحظات':x.notes}));if(type==='consumedFuel')return fls.filter(x=>x.type==='consumed').map(x=>({'التاريخ':x.date,'اليوم':x.day,'الوقت':x.time,'الجهة/الغرض':x.consumedFor,'الكمية المستهلكة لتر':x.quantityLiters,'المستلم/المشغل':x.receivedBy,'ملاحظات':x.notes}));if(type==='fuelSummary'){const incoming=fls.filter(x=>x.type!=='consumed').reduce((s,x)=>s+num(x.quantityLiters),0),consumed=fls.filter(x=>x.type==='consumed').reduce((s,x)=>s+num(x.quantityLiters),0);return incoming||consumed?[{'إجمالي الوارد':incoming,'إجمالي المستهلك':consumed,'الصافي':incoming-consumed}]:[]}if(type==='producedWater')return reps.map(r=>({'التاريخ':r.reportDate,'العنوان':r.title,'الإنتاج':r.water?.dailyProduction||0,'العادم':r.water?.rejectWater||0,'نسبة الفاقد':r.water?.lossPercentage||0}));if(type==='deliveredWater'||type==='beneficiaries'||type==='beneficiaryOne')return reps.flatMap(r=>(r.beneficiaries||[]).filter(b=>type!=='beneficiaryOne'||!ben||String(b.name||'').includes(ben)).map(b=>({'التاريخ':r.reportDate,'العنوان':r.title,'الجهة':b.name,'الكمية':b.quantity,'السيارات':b.cars})));if(type==='monthlyShort'){const s=window.ReportUtils?.summary?window.ReportUtils.summary(reps):{};return reps.length?[{'عدد التقارير':reps.length,'ساعات التشغيل':s.runHours||0,'الوقود المستهلك':s.fuelConsumed||0,'إنتاج المياه':s.waterProduction||0,'المياه المعبأة':s.filledWater||0,'عدد السيارات':s.cars||0}]:[]}return reps.map(r=>({'التاريخ':r.reportDate,'العنوان':r.title,'المحطة':r.stationName,'ساعات التشغيل':r.generator?.totalRunHours,'الوقود':r.fuel?.consumedDaily,'الإنتاج':r.water?.dailyProduction,'المعبأ':r.water?.filledWater,'السيارات':r.water?.carsCount}))}
function render(rs){const P=window.ExportV4,keys=Object.keys(rs[0]||{}),show=rs.slice(0,6);P.state.rows=rs;document.getElementById('exportV4Preview').innerHTML='<div class="export-v4-summary"><article><strong>'+rs.length+'</strong><span>عدد النتائج</span></article><article><strong>'+keys.length+'</strong><span>عدد الأعمدة</span></article><article><strong>'+((rs[0]||{})['التاريخ']||'-')+'</strong><span>أول نتيجة</span></article><article><strong>'+((rs[rs.length-1]||{})['التاريخ']||'-')+'</strong><span>آخر نتيجة</span></article></div><div class="export-v4-table-wrap"><table><thead><tr>'+keys.map(k=>'<th>'+P.esc(k)+'</th>').join('')+'</tr></thead><tbody>'+show.map(r=>'<tr>'+keys.map(k=>'<td>'+P.esc(r[k])+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><div class="export-v4-downloads"><button class="export-v4-download" onclick="ExportV4Runner.download(\'excel\')">تصدير Excel</button><button class="export-v4-download" onclick="ExportV4Runner.download(\'pdf\')">تصدير PDF</button></div>'}
async function preview(){try{const P=window.ExportV4;P.status('جاري جلب البيانات...');const fd=f(),type=P.state.type;const allR=await reports(),allF=await fuels();const rs=rows(type,filterReports(allR,fd,type),filterFuels(allF,fd),fd);if(!rs.length){P.status('لا توجد بيانات ضمن الفلاتر المحددة.','warn');document.getElementById('exportV4Preview').innerHTML='<p class="muted">لا توجد نتائج.</p>';return}render(rs);P.status('تمت المعاينة: '+rs.length+' سجل.','ok')}catch(e){console.error(e);window.ExportV4?.status(e.message||'فشل إنشاء المعاينة','warn')}}
function download(kind){const P=window.ExportV4,rs=P.state.rows||[];if(!rs.length){P.status('اعمل معاينة أولًا.','warn');return}const name=P.types[P.state.type].label;if(kind==='excel'){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rs),'Export');XLSX.writeFile(wb,name+'.xlsx');P.status('تم تجهيز Excel.','ok');return}const keys=Object.keys(rs[0]);const w=window.open('','_blank');w.document.write('<html lang="ar" dir="rtl"><body><h1>'+P.esc(name)+'</h1><table border="1" cellspacing="0" cellpadding="6"><tr>'+keys.map(k=>'<th>'+P.esc(k)+'</th>').join('')+'</tr>'+rs.map(r=>'<tr>'+keys.map(k=>'<td>'+P.esc(r[k])+'</td>').join('')+'</tr>').join('')+'</table><script>print()<\/script></body></html>');w.document.close();P.status('تم تجهيز PDF.','ok')}
window.ExportV4Runner={preview,download};
})();

