(() => {
  const BUILD_ID = window.WATER_APP_BUILD || '20260518-production-sync-1';
  const BUILD_KEY = 'waterAppBuildId';
  const SAFE_CACHE_KEYS = [/cache/i, /snapshot/i, /lastHtml/i, /stale/i, /oldUi/i];

  document.documentElement.dataset.waterBuild = BUILD_ID;
  document.documentElement.dataset.waterBooting = 'true';

  function safeStorageCleanup(previousBuild) {
    if (!previousBuild || previousBuild === BUILD_ID) return;
    try {
      Object.keys(localStorage).forEach(key => {
        if (key === 'waterAppDefaultSettings') return;
        if (key === BUILD_KEY) return;
        if (SAFE_CACHE_KEYS.some(pattern => pattern.test(key))) localStorage.removeItem(key);
      });
    } catch (error) {
      console.warn('Local storage cleanup skipped', error);
    }
  }

  async function clearBrowserCaches() {
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      }
    } catch (error) {
      console.warn('Runtime cache cleanup skipped', error);
    }

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
      }
    } catch (error) {
      console.warn('Service worker cleanup skipped', error);
    }
  }

  function markBuild() {
    try {
      const previousBuild = localStorage.getItem(BUILD_KEY);
      safeStorageCleanup(previousBuild);
      localStorage.setItem(BUILD_KEY, BUILD_ID);
      localStorage.setItem('waterAppLastBootAt', new Date().toISOString());
    } catch (error) {
      console.warn('Build marker skipped', error);
    }
  }

  function forceVersionedUrl() {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('v') === BUILD_ID) return;
      if (sessionStorage.getItem(`waterAppVersionUrl:${BUILD_ID}`) === 'done') return;
      sessionStorage.setItem(`waterAppVersionUrl:${BUILD_ID}`, 'done');
      url.searchParams.set('v', BUILD_ID);
      window.location.replace(url.toString());
    } catch (error) {
      console.warn('Version URL guard skipped', error);
    }
  }

  function releaseBootLock() {
    document.documentElement.removeAttribute('data-water-booting');
    document.documentElement.dataset.waterReady = BUILD_ID;
  }

  window.WaterVersionGuard = {
    BUILD_ID,
    clearBrowserCaches,
    releaseBootLock,
    forceReload() {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('v', BUILD_ID);
        url.searchParams.set('r', String(Date.now()));
        window.location.replace(url.toString());
      } catch {
        window.location.reload();
      }
    }
  };

  markBuild();
  clearBrowserCaches();
  forceVersionedUrl();
  setTimeout(releaseBootLock, 4500);
})();
