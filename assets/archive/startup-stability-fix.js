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
