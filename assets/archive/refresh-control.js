(() => {
  const REFRESH_PARAM = 'r';

  function ensureButton() {
    if (document.getElementById('hardRefreshBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'hardRefreshBtn';
    btn.className = 'hard-refresh-btn';
    btn.type = 'button';
    btn.title = 'تحديث قوي';
    btn.setAttribute('aria-label', 'تحديث قوي');
    btn.innerHTML = '<span>↻</span>';
    btn.addEventListener('click', hardRefresh);
    document.body.appendChild(btn);
  }

  function toast(message) {
    document.querySelectorAll('.hard-refresh-toast').forEach(el => el.remove());
    const el = document.createElement('div');
    el.className = 'hard-refresh-toast';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }

  async function hardRefresh() {
    const btn = document.getElementById('hardRefreshBtn');
    btn?.classList.add('is-loading');
    toast('جاري التحديث القوي...');

    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      }
    } catch (error) {
      console.warn('Cache clear skipped', error);
    }

    try {
      localStorage.setItem('waterAppForceRefreshAt', String(Date.now()));
    } catch {}

    const url = new URL(window.location.href);
    url.searchParams.set(REFRESH_PARAM, String(Date.now()));
    window.location.replace(url.toString());
  }

  function updateFuelLabelsOnce() {
    const cards = [...document.querySelectorAll('.kpi-card, .kpi-wide')];
    const incomingCard = cards.find(card => /إجمالي السولار المستلم|سولار مستلم|وقود وارد/.test(card.textContent || ''));
    const consumedCard = cards.find(card => /وقود مستهلك|إجمالي السولار المستهلك|وقود مستخدم/.test(card.textContent || ''));
    const stockCard = cards.find(card => /السولار في المخزون|آخر رصيد|وقود متبقي/.test(card.textContent || ''));

    if (incomingCard) {
      const span = incomingCard.querySelector('span');
      const small = incomingCard.querySelector('small');
      if (span) span.textContent = 'وقود وارد';
      if (small) small.textContent = 'من زر إضافة وقود وارد';
      incomingCard.classList.add('fuel-incoming-kpi');
    }
    if (consumedCard) {
      const span = consumedCard.querySelector('span');
      const small = consumedCard.querySelector('small');
      if (span) span.textContent = 'وقود مستخدم';
      if (small) small.textContent = 'من استهلاك التقارير اليومية';
      consumedCard.classList.add('fuel-consumed-kpi');
    }
    if (stockCard) {
      const span = stockCard.querySelector('span');
      const small = stockCard.querySelector('small');
      if (span) span.textContent = 'وقود متبقي';
      if (small) small.textContent = 'الوارد - المستخدم';
      stockCard.classList.add('fuel-remaining-kpi');
    }
  }

  function start() {
    ensureButton();
    updateFuelLabelsOnce();
    setTimeout(updateFuelLabelsOnce, 500);
    setTimeout(updateFuelLabelsOnce, 1800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
