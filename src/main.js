// Main entry – bootstraps the PWA
import { loadDataFromLocalStorage } from './core/storage.js';
import { initializeTheme, toggleTheme, forceLightMode } from './ui/theme.js';
import { initializeNavigation } from './ui/navigation.js';
import { initializeHabitsForm } from './ui/habits/form.js';
import { initializeHome } from './ui/home.js';
import { initializeFitness } from './ui/fitness.js';
import { initializeStats } from './ui/stats.js';
import { initializeInstallPrompt } from './ui/installPrompt.js';
import { showUpdateBanner } from './ui/updatePrompt.js';
import './features/autoToday.js';

// Enable test mode if URL contains ?test=true
if (
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('test') === 'true'
) {
  window.process = window.process || {};
  window.process.env = window.process.env || {};
  window.process.env.NODE_ENV = 'test';
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('sw.js')
        .then((reg) => {
          if (reg.waiting) {
            showUpdateBanner();
          }
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  showUpdateBanner();
                }
              });
            }
          });
        })
        .catch((err) => console.error('[sw] registration failed', err));
    });
  }
}

function bootstrap() {
  registerServiceWorker();

  // Load data first, then initialize UI components
  loadDataFromLocalStorage()
    .then(() => {
      // Force app to start on Home view (Daily group) every launch
      localStorage.removeItem('activeHabitTrackerTab');
      import('./core/state.js').then(({ appData }) => {
        appData.selectedGroup = 'daily';
      });

      // Force light mode to ensure app starts in light mode
      forceLightMode();

      initializeTheme();
      initializeNavigation();
      initializeHabitsForm();
      initializeHome();
      initializeFitness();
      initializeStats();
      initializeInstallPrompt();

      // Theme toggle click handler
      const themeToggle = document.getElementById('theme-toggle');
      if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
      }
    })
    .catch((error) => {
      console.error('[DEBUG] Bootstrap failed:', error);
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  // DOMContentLoaded already fired
  bootstrap();
}
