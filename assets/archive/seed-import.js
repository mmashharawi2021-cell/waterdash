(() => {
  const BUTTON_ID = 'importSeedReportsButton';

  function currentUser() {
    try {
      return firebase.auth().currentUser;
    } catch {
      return null;
    }
  }

  async function upsertByDate(report) {
    const db = firebase.firestore();
    const snap = await db.collection('reports')
      .where('reportDate', '==', report.reportDate)
      .limit(1)
      .get();

    const user = currentUser();
    if (!snap.empty) {
      const id = snap.docs[0].id;
      await window.FirebaseService.saveReport(report, user, id);
      return { date: report.reportDate, mode: 'updated' };
    }

    await window.FirebaseService.saveReport(report, user, null);
    return { date: report.reportDate, mode: 'created' };
  }

  async function importSeedReports() {
    if (!Array.isArray(window.SEED_REPORTS) || !window.SEED_REPORTS.length) {
      alert('لا توجد تقارير قديمة جاهزة للاستيراد.');
      return;
    }

    const ok = confirm(`سيتم استيراد ${window.SEED_REPORTS.length} تقارير قديمة إلى Firestore. إذا كان تقرير بنفس التاريخ موجودًا سيتم تحديثه. هل تريد المتابعة؟`);
    if (!ok) return;

    const button = document.getElementById(BUTTON_ID);
    if (button) {
      button.disabled = true;
      button.textContent = 'جاري الاستيراد...';
    }

    try {
      const results = [];
      for (const report of window.SEED_REPORTS) {
        const cleanReport = window.ReportUtils.recalc(report);
        results.push(await upsertByDate(cleanReport));
      }

      const created = results.filter(item => item.mode === 'created').length;
      const updated = results.filter(item => item.mode === 'updated').length;
      alert(`تم الاستيراد بنجاح.\nتقارير جديدة: ${created}\nتقارير محدثة: ${updated}`);
    } catch (error) {
      console.error(error);
      alert('فشل استيراد التقارير. راجع صلاحيات Firestore أو اتصال الإنترنت.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'استيراد التقارير القديمة';
      }
    }
  }

  function injectButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const actions = document.querySelector('.hero-actions');
    if (!actions) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.className = 'btn';
    button.type = 'button';
    button.textContent = 'استيراد التقارير القديمة';
    button.addEventListener('click', importSeedReports);
    actions.insertBefore(button, actions.children[1] || null);
  }

  const observer = new MutationObserver(injectButton);
  window.addEventListener('DOMContentLoaded', () => {
    injectButton();
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
