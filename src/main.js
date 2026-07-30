// Main entry – bootstraps the PWA
import { initializeTheme } from './core/theme.js';
import { initializeNavigation } from './core/navigation.js';
import { initializeInstallPrompt } from './components/InstallPrompt.js';
import { isCloudBackend } from './core/dataBackend.js';
import { markStartup } from './core/startupMetrics.js';
import { removeLoadingState } from './shared/loader.js';
import {
  assertTestHarnessConfiguration,
  isTestHarnessEnabled,
} from './core/testHarness.js';

async function bootstrap() {
  markStartup('bootstrapStart');
  try {
    assertTestHarnessConfiguration();
    const testHarness = isTestHarnessEnabled();

    // The test harness deliberately starts with reducer-owned in-memory state.
    // It must stay before the backend check so a cloud-configured test server
    // never initializes Clerk, Convex, IndexedDB, or legacy browser storage.
    let persistence;
    if (testHarness) {
      persistence = { mode: 'test_harness' };
    } else if (isCloudBackend()) {
      persistence = await import('./core/cloudBootstrap.js').then((module) =>
        module.bootstrapCloudPersistence()
      );
    } else {
      persistence = await import('./core/storage.js').then((module) =>
        module.loadDataFromLocalStorage()
      );
    }
    markStartup('persistenceReady');
    if (persistence?.access === 'blocked') {
      await removeLoadingState();
      return;
    }

    // Proactively clear any persisted last-active tab so app always opens to Home
    if (!isCloudBackend() && !testHarness) {
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

    // Remove loading state after all initializations are complete
    await removeLoadingState();
    markStartup('visible');

    // Features that are not required by the visible Home screen stay out of
    // the loading path. Navigation loads Fitness and Statistics on demand.
    const initializeDeferredFeatures = async () => {
      await import('./features/autoToday.js');
      if (isCloudBackend() && !testHarness) {
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
