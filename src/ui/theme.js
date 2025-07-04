import { appData } from '../core/state.js';

export function forceLightMode() {
  appData.settings.darkMode = false;
  localStorage.removeItem('theme');
  localStorage.setItem('theme', 'light');
  applyTheme();
}

export function initializeTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === null) {
    appData.settings.darkMode = false;
    localStorage.setItem('theme', 'light');
  } else {
    appData.settings.darkMode = savedTheme === 'dark';
  }
  applyTheme();
}

export function toggleTheme() {
  appData.settings.darkMode = !appData.settings.darkMode;
  applyTheme();
  localStorage.setItem('theme', appData.settings.darkMode ? 'dark' : 'light');
}

export function applyTheme() {
  const theme = appData.settings.darkMode ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  // Update theme toggle icon if present
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const icon = themeToggle.querySelector('svg');
    if (!icon) return;
    if (appData.settings.darkMode) {
      // Moon icon
      icon.innerHTML =
        '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2" fill="none"/>';
    } else {
      // Sun icon
      icon.innerHTML =
        '<circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2"/>';
    }
  }
}
