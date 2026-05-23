(() => {
  const STORAGE_KEY = 'waterAppThemeMode';
  const LEGACY_KEY = 'waterAppTheme';
  const allowed = ['dark', 'light'];

  function cleanThemeClasses() {
    document.body.classList.remove(
      'theme-ocean', 'theme-midnight', 'theme-copper', 'theme-graphite',
      'theme-emerald', 'theme-sand', 'theme-iceblue', 'theme-dark', 'theme-light'
    );
  }

  function ensureModeSwitcher() {
    if (!document.body) return null;
    let dock = document.getElementById('modeSwitcher');
    if (!dock) {
      dock = document.createElement('div');
      dock.id = 'modeSwitcher';
      dock.className = 'theme-switch-shell';
      dock.innerHTML = `
        <button
          id="themeToggle"
          class="theme-toggle"
          type="button"
          aria-label="تبديل الوضع"
          aria-pressed="false"
          title="تبديل الوضع"
        >
          <span class="theme-toggle-led" aria-hidden="true"></span>
          <span class="theme-toggle-track" aria-hidden="true">
            <span class="theme-toggle-thumb"></span>
          </span>
        </button>
      `;
      document.body.appendChild(dock);
      dock.querySelector('#themeToggle')?.addEventListener('click', () => {
        const current = window.ThemeManager?.current?.() || 'dark';
        const next = current === 'light' ? 'dark' : 'light';
        window.ThemeManager?.saveUserTheme?.(next);
      });
    }
    return dock;
  }

  function syncSwitcher(selected) {
    const dock = ensureModeSwitcher();
    const toggle = dock?.querySelector('#themeToggle');
    if (!toggle) return;
    const isLight = selected === 'light';
    toggle.setAttribute('aria-pressed', String(isLight));
    toggle.classList.toggle('is-on', isLight);
  }

  function applyTheme(theme) {
    const selected = allowed.includes(theme) ? theme : 'dark';
    cleanThemeClasses();
    document.body.classList.add(`theme-${selected}`);
    document.documentElement.dataset.theme = selected;
    try {
      localStorage.setItem(STORAGE_KEY, selected);
      localStorage.removeItem(LEGACY_KEY);
    } catch {}
    syncSwitcher(selected);
  }

  function getInitialTheme() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('mode') || params.get('theme');
    if (allowed.includes(fromUrl)) return fromUrl;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (allowed.includes(stored)) return stored;
    } catch {}
    return 'dark';
  }

  async function saveUserTheme(theme) {
    applyTheme(theme);
    try {
      if (!window.firebase || !firebase.auth || !firebase.firestore) return;
      const user = firebase.auth().currentUser;
      if (!user) return;
      await firebase.firestore().collection('userPreferences').doc(user.uid).set({
        themeMode: theme,
        theme: theme,
        userName: window.WATER_APP_SETTINGS?.defaultUserName || 'صالح الدحنون',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.warn('Theme mode preference was saved locally only.', error);
    }
  }

  async function loadUserTheme(user) {
    try {
      if (!user || !window.firebase || !firebase.firestore) return;
      const snap = await firebase.firestore().collection('userPreferences').doc(user.uid).get();
      const data = snap.exists ? snap.data() : {};
      const saved = data?.themeMode || data?.theme;
      if (allowed.includes(saved)) applyTheme(saved);
    } catch (error) {
      console.warn('Could not load remote theme mode preference.', error);
    }
  }

  window.ThemeManager = {
    allowed,
    applyTheme,
    saveUserTheme,
    loadUserTheme,
    current: () => document.documentElement.dataset.theme || 'dark'
  };

  if (document.body) applyTheme(getInitialTheme());
  else window.addEventListener('DOMContentLoaded', () => applyTheme(getInitialTheme()));
})();
