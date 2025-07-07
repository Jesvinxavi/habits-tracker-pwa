// Main entry – bootstraps the PWA
import { loadDataFromLocalStorage } from './core/storage.js';
import { initializeTheme, toggleTheme, forceLightMode } from './core/theme.js';
import { initializeNavigation } from './core/navigation.js';
import { initializeHabitsForm } from './features/habits/modals/HabitFormModal.js';
// import { initializeHome } from './features/home/home.js'; // Now lazy loaded via navigation
import { initializeFitness } from './features/fitness/FitnessModule.js';
import { initializeInstallPrompt } from './components/InstallPrompt.js';
import { showUpdateBanner } from './components/UpdatePrompt.js';
import { measurePerformance } from './shared/common.js';
import performanceMonitor from './features/fitness/performance.js';
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

async function bootstrap() {
  const bootstrapStart = performance.now();

  try {
    // Register service worker
    registerServiceWorker();

    // Load data first, then initialize UI components
    await measurePerformance('Data Loading', () => loadDataFromLocalStorage());

    // Force app to start on Home view (Daily group) every launch
    localStorage.removeItem('activeHabitTrackerTab');
    import('./core/state.js').then(({ appData }) => {
      appData.selectedGroup = 'daily';
    });

    // Force light mode to ensure app starts in light mode
    forceLightMode();

    // Initialize core components with performance tracking
    await measurePerformance('Theme Initialization', () => initializeTheme());
    await measurePerformance('Navigation Initialization', () => initializeNavigation());
    await measurePerformance('Habits Form Initialization', () => initializeHabitsForm());
    // await measurePerformance('Home Initialization', () => initializeHome()); // Now lazy loaded via navigation
    // Debug logging removed for production
    await measurePerformance('Fitness Initialization', () => initializeFitness());
    await measurePerformance('Stats Initialization', () =>
      import('./features/stats/stats.js').then((m) => m.initializeStats())
    );
    await measurePerformance('Install Prompt Initialization', () => initializeInstallPrompt());

    // Theme toggle click handler
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
    }

    // Record successful bootstrap
    const bootstrapTime = performance.now() - bootstrapStart;
    performanceMonitor.recordInteraction('app_bootstrap', {
      duration: bootstrapTime,
      success: true,
      timestamp: Date.now(),
    });

    // Debug logging removed for production
  } catch (error) {
    console.error('[DEBUG] Bootstrap failed:', error);

    // Record failed bootstrap
    const bootstrapTime = performance.now() - bootstrapStart;
    performanceMonitor.recordInteraction('app_bootstrap', {
      duration: bootstrapTime,
      success: false,
      error: error.message,
      timestamp: Date.now(),
    });
  }
}

// Expose performance monitor for debugging
if (typeof window !== 'undefined') {
  window.performanceMonitor = performanceMonitor;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  // DOMContentLoaded already fired
  bootstrap();
}
