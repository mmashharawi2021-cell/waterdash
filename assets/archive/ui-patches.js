(() => {
  function replaceIceBlueWithCopper(html) {
    return String(html)
      .replaceAll("['iceblue', 'أزرق ثلجي']", "['copper', 'نحاسي رسمي']")
      .replaceAll('theme-dot-iceblue', 'theme-dot-copper')
      .replaceAll('data-theme-dot="iceblue"', 'data-theme-dot="copper"')
      .replaceAll("ThemeManager.saveUserTheme('iceblue')", "ThemeManager.saveUserTheme('copper')")
      .replaceAll('أزرق ثلجي', 'نحاسي رسمي');
  }

  function patchAppUI() {
    if (!window.AppUI || window.AppUI.__patchedThemeDots) return;
    const originalLogin = window.AppUI.login;
    const originalLayout = window.AppUI.layout;
    window.AppUI.login = (...args) => replaceIceBlueWithCopper(originalLogin(...args));
    window.AppUI.layout = (...args) => replaceIceBlueWithCopper(originalLayout(...args));
    window.AppUI.__patchedThemeDots = true;
  }

  patchAppUI();
  window.addEventListener('DOMContentLoaded', patchAppUI);
})();
