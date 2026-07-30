// Main entry – bootstraps the PWA
import '@material-design-icons/font/filled.css';
import { initializeTheme } from './core/theme.js';
import { initializeNavigation } from './core/navigation.js';
import { initializeInstallPrompt } from './components/InstallPrompt.js';
import { initializePwaUpdateCoordinator } from './components/PwaUpdateCoordinator.js';
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
    // It stays before cloud bootstrap so a UI-test server never initializes
    // Clerk, Convex, IndexedDB, or any account-scoped background work.
    let persistence;
    if (testHarness) {
      persistence = { mode: 'test_harness' };
    } else {
      persistence = await import('./core/cloudBootstrap.js').then((module) =>
        module.bootstrapCloudPersistence()
      );
    }
    markStartup('persistenceReady');
    if (persistence?.access === 'blocked') {
      await removeLoadingState();
      return;
    }

    // Initialize core components
    await initializeTheme();
    await import('./features/holidays/holidays.js').then((module) =>
      module.initializeHolidays()
    );
    await initializeNavigation();
    markStartup('homeReady');
    await initializeInstallPrompt();
    if (!testHarness || import.meta.env.VITE_PWA_TEST === '1') {
      void initializePwaUpdateCoordinator().catch((error) => {
        console.warn('PWA update coordination failed:', error);
      });
    }

    // Remove loading state after all initializations are complete
    await removeLoadingState();
    markStartup('visible');

    // Features that are not required by the visible Home screen stay out of
    // the loading path. Navigation loads Fitness and Statistics on demand.
    const initializeDeferredFeatures = async () => {
      await import('./features/autoToday.js');
      if (!testHarness) {
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
