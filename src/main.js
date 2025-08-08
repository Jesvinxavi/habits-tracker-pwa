// Main entry – bootstraps the PWA
import { loadDataFromLocalStorage } from './core/storage.js';
import { initializeTheme, toggleTheme } from './core/theme.js';
import { initializeNavigation } from './core/navigation.js';
import { initializeHabitsForm } from './features/habits/modals/HabitFormModal.js';
import { initializeInstallPrompt } from './components/InstallPrompt.js';
import { showUpdateBanner } from './components/UpdatePrompt.js';
import { initializeFitness } from './features/fitness/FitnessModule.js';

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

async function bootstrap() {
  try {
    // Load data first, then initialize UI components
    await loadDataFromLocalStorage();

    // Proactively clear any persisted last-active tab so app always opens to Home
    try { localStorage.removeItem('activeHabitTrackerTab'); } catch (_) {}

    // Initialize core components
    await initializeTheme();
    await initializeNavigation();
    await initializeHabitsForm();
    await import('./features/holidays/holidays.js').then(m => m.initializeHolidays());
    // Eagerly initialise the Fitness view so it is ready instantly when the user navigates to it.
    await initializeFitness();
    await import('./features/stats/stats.js').then((m) => m.initializeStats());
    await initializeInstallPrompt();

    // Theme toggle click handler
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
    }

    // Remove loading state after all initializations are complete
    import('./shared/loader.js').then(({ removeLoadingState }) => removeLoadingState());
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
