// Main entry – bootstraps the PWA
import { loadDataFromLocalStorage } from './core/storage.js';
import { initializeTheme, toggleTheme } from './core/theme.js';
import { initializeNavigation } from './core/navigation.js';
import { initializeInstallPrompt } from './components/InstallPrompt.js';
import { isCloudBackend } from './core/dataBackend.js';
import { markStartup } from './core/startupMetrics.js';

// Enable test mode if URL contains ?test=true
if (
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('test') === 'true'
) {
  window.process = window.process || {};
  window.process.env = window.process.env || {};
  window.process.env.NODE_ENV = 'test';
}

async function bootstrap() {
  markStartup('bootstrapStart');
  try {
    // Load data first, then initialize UI components
    const persistence = isCloudBackend()
      ? await import('./core/cloudBootstrap.js').then((module) =>
          module.bootstrapCloudPersistence()
        )
      : await loadDataFromLocalStorage();
    markStartup('persistenceReady');
    if (persistence?.access === 'blocked') {
      const { removeLoadingState } = await import('./shared/loader.js');
      await removeLoadingState();
      return;
    }

    // Proactively clear any persisted last-active tab so app always opens to Home
    if (!isCloudBackend()) {
      try {
        localStorage.removeItem('activeHabitTrackerTab');
      } catch (error) {
        console.warn('Failed to clear activeHabitTrackerTab:', error);
      }
    }

    // Initialize core components
    await initializeTheme();
    await import('./features/holidays/holidays.js').then((module) =>
      module.initializeHolidays()
    );
    await initializeNavigation();
    markStartup('homeReady');
    await initializeInstallPrompt();

    // Theme toggle click handler
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
    }

    // Remove loading state after all initializations are complete
    const { removeLoadingState } = await import('./shared/loader.js');
    await removeLoadingState();
    markStartup('visible');

    // Features that are not required by the visible Home screen stay out of
    // the loading path. Navigation loads Fitness and Statistics on demand.
    const initializeDeferredFeatures = async () => {
      await import('./features/autoToday.js');
      if (isCloudBackend()) {
        const { initializeSyncStatusUi } = await import('./core/syncStatusUi.js');
        initializeSyncStatusUi();
      }
    };
    const startDeferredFeatures = () => {
      void initializeDeferredFeatures().catch((error) => {
        console.warn('Deferred feature initialization failed:', error);
      });
    };
    if ('requestIdleCallback' in window) {
      requestIdleCallback(startDeferredFeatures, { timeout: 1500 });
    } else {
      setTimeout(startDeferredFeatures, 0);
    }
  } catch (error) {
    console.error('Bootstrap failed:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  // DOMContentLoaded already fired
  bootstrap();
}
