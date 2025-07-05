import { appData } from '../core/state.js';
import { measurePerformance } from '../utils/common.js';

export function initializeNavigation() {
  const tabItems = document.querySelectorAll('.tab-item');
  const views = document.querySelectorAll('.view');

  // Lazy-load static placeholder markup for empty views
  const PLACEHOLDERS = {
    'fitness-view': `
      <header class="app-header flex justify-between items-center h-11 px-4 sm:px-6 lg:px-8 border-b border-gray-200 dark:border-gray-700 w-full">
        <button class="back-btn text-ios-blue text-lg lg:text-xl">←</button>
        <h1 class="app-title text-lg font-semibold lg:text-xl">Fitness</h1>
        <button class="add-btn text-ios-blue text-2xl lg:text-3xl">+</button>
      </header>
      <div class="placeholder-content text-center py-16 px-4 sm:px-6 lg:px-8 text-gray-500">
        <div class="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center lg:w-20 lg:h-20">
          <svg class="w-8 h-8 lg:w-10 lg:h-10" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
          </svg>
        </div>
        <p class="text-lg font-medium lg:text-xl">Fitness tracking will be built here</p>
      </div>`,
    'stats-view': `
      <header class="app-header flex justify-between items-center h-11 px-4 sm:px-6 lg:px-8 border-b border-gray-200 dark:border-gray-700 w-full">
        <button class="back-btn text-ios-blue text-lg lg:text-xl">←</button>
        <h1 class="app-title text-lg font-semibold lg:text-xl">Statistics</h1>
        <button class="add-btn text-ios-blue text-2xl lg:text-3xl">+</button>
      </header>
      <div class="placeholder-content text-center py-16 px-4 sm:px-6 lg:px-8 text-gray-500">
        <div class="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center lg:w-20 lg:h-20">
          <svg class="w-8 h-8 lg:w-10 lg:h-10" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z"/>
            <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z"/>
          </svg>
        </div>
        <p class="text-lg font-medium lg:text-xl">Statistics and analytics will be built here</p>
      </div>`,
  };

  // Module loading state tracking
  const moduleStates = {
    home: { loaded: false, loading: false, error: null },
    habits: { loaded: false, loading: false, error: null },
    fitness: { loaded: false, loading: false, error: null },
    stats: { loaded: false, loading: false, error: null },
  };

  function ensurePlaceholder(viewId) {
    let el = document.getElementById(viewId);
    if (!el) {
      // Create container lazily when it wasn't present in initial HTML
      el = document.createElement('div');
      el.id = viewId;
      el.className = 'view w-full h-full flex flex-col overflow-hidden';
      document.querySelector('main.content-area')?.appendChild(el);
    }
    if (el.childElementCount === 0 && PLACEHOLDERS[viewId]) {
      el.insertAdjacentHTML('beforeend', PLACEHOLDERS[viewId]);
    }
  }

  // Advanced lazy loading with performance monitoring
  async function loadHomeModules() {
    if (moduleStates.home.loaded || moduleStates.home.loading) return;

    moduleStates.home.loading = true;
    const startTime = performance.now();

    const homeView = document.getElementById('home-view');
    let spinner;
    if (homeView && !homeView.querySelector('#home-loading')) {
      spinner = document.createElement('div');
      spinner.id = 'home-loading';
      spinner.className = 'flex flex-col items-center justify-center flex-grow py-10 text-gray-400';
      spinner.innerHTML = `
        <svg class="animate-spin w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        <p class="text-sm">Loading Home...</p>`;
      homeView.appendChild(spinner);
    }

    try {
      // Load the new HomeModule that orchestrates everything
      const { HomeModule } = await measurePerformance(
        'HomeModule Import',
        () => import('../home/HomeModule.js')
      );

      await measurePerformance('HomeModule Init', () => HomeModule.init());

      moduleStates.home.loaded = true;
      const loadTime = performance.now() - startTime;

      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Performance logging for development
      }
    } catch (error) {
      console.error('Error loading home modules:', error);
      moduleStates.home.error = error;
    } finally {
      moduleStates.home.loading = false;
      spinner?.remove();
    }
  }

  async function loadHabitsModules() {
    if (moduleStates.habits.loaded || moduleStates.habits.loading) return;

    moduleStates.habits.loading = true;
    const startTime = performance.now();

    const habitsView = document.getElementById('habits-view');
    let spinner;
    if (habitsView && !habitsView.querySelector('#habits-loading')) {
      spinner = document.createElement('div');
      spinner.id = 'habits-loading';
      spinner.className = 'flex flex-col items-center justify-center flex-grow py-10 text-gray-400';
      spinner.innerHTML = `
        <svg class="animate-spin w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        <p class="text-sm">Loading Habits...</p>`;
      habitsView.appendChild(spinner);
    }

    try {
      // Load the new HabitsModule that orchestrates everything
      const { HabitsModule } = await measurePerformance(
        'HabitsModule Import',
        () => import('../habits/HabitsModule.js')
      );

      await measurePerformance('HabitsModule Init', () => HabitsModule.init());

      moduleStates.habits.loaded = true;
      const loadTime = performance.now() - startTime;

      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Performance logging for development
      }
    } catch (error) {
      console.error('Error loading habits modules:', error);
      moduleStates.habits.error = error;
    } finally {
      moduleStates.habits.loading = false;
      spinner?.remove();
    }
  }

  // Enhanced view switching with performance monitoring
  async function setActiveView(viewId) {
    const switchStart = performance.now();

    ensurePlaceholder(viewId);

    // Batch DOM updates for better performance
    const updateViews = () => {
      views.forEach((view) => {
        if (view.id === viewId) {
          view.classList.add('active-view');
          view.classList.remove('hidden');
          view.classList.add('block');
        } else {
          view.classList.remove('active-view');
          view.classList.add('hidden');
          view.classList.remove('block');
        }
      });

      tabItems.forEach((item) => {
        item.classList.toggle('active', item.dataset.view === viewId);
      });
    };

    // Use requestAnimationFrame for smooth transitions
    requestAnimationFrame(updateViews);

    localStorage.setItem('activeHabitTrackerTab', viewId);

    // Ensure Fitness view always starts on today
    if (viewId === 'fitness-view') {
      // Use local date to avoid timezone issues
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset to local midnight
      const { getLocalISODate } = await import('../utils/datetime.js');
      const localToday = getLocalISODate(today) + 'T00:00:00.000Z';
      appData.fitnessSelectedDate = localToday;
      if (window.fitnessCalendarApi && typeof window.fitnessCalendarApi.refresh === 'function') {
        window.fitnessCalendarApi.refresh();
      }
    }

    // Trigger lazy load when views become active
    if (viewId === 'home-view') {
      loadHomeModules();
    } else if (viewId === 'habits-view') {
      loadHabitsModules();
    }

    const switchTime = performance.now() - switchStart;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Performance logging for development
    }
  }

  // Default view
  const savedView = localStorage.getItem('activeHabitTrackerTab') || 'home-view';

  setActiveView(savedView);

  // If home view is the default, ensure home modules are loaded
  if (savedView === 'home-view') {
    loadHomeModules();
  }

  tabItems.forEach((item) => {
    item.addEventListener('click', async (e) => {
      const viewId = item.dataset.view;

      if (!viewId) {
        console.error('No view ID found in dataset!');
        return;
      }

      e.preventDefault();
      await setActiveView(viewId);
    });
  });

  // Advanced prefetching with intersection observer
  let _homePrefetched = false;
  let _habitsPrefetched = false;
  let _fitnessPrefetched = false;
  let _statsPrefetched = false;

  function prefetchModule(moduleName) {
    const moduleMap = {
      home: () => import('../home/HomeModule.js'),
      habits: () => import('../habits/HabitsModule.js'),
      fitness: () => import('../fitness/FitnessModule.js'),
      stats: () => import('../features/stats/stats.js'),
    };

    const prefetchState = `_${moduleName}Prefetched`;
    if (window[prefetchState] || moduleStates[moduleName]?.loaded) return;

    window[prefetchState] = true;

    // Fire and forget – this will cache the chunks
    moduleMap[moduleName]().catch((err) => {
      console.warn(`Failed to prefetch ${moduleName} module:`, err);
      window[prefetchState] = false; // Reset on error
    });
  }

  // Prefetch when tabs are hovered
  const homeTab = document.querySelector('.tab-item[data-view="home-view"]');
  const habitsTab = document.querySelector('.tab-item[data-view="habits-view"]');
  const fitnessTab = document.querySelector('.tab-item[data-view="fitness-view"]');
  const statsTab = document.querySelector('.tab-item[data-view="stats-view"]');

  if (homeTab) {
    homeTab.addEventListener('pointerenter', () => prefetchModule('home'), { once: true });
  }
  if (habitsTab) {
    habitsTab.addEventListener('pointerenter', () => prefetchModule('habits'), { once: true });
  }
  if (fitnessTab) {
    fitnessTab.addEventListener('pointerenter', () => prefetchModule('fitness'), { once: true });
  }
  if (statsTab) {
    statsTab.addEventListener('pointerenter', () => prefetchModule('stats'), { once: true });
  }

  // Prefetch when page becomes hidden (user likely to come back soon)
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      prefetchModule('home');
      prefetchModule('habits');
      prefetchModule('fitness');
      prefetchModule('stats');
    }
  });

  // Prefetch on idle time
  if ('requestIdleCallback' in window) {
    requestIdleCallback(
      () => {
        prefetchModule('home');
        prefetchModule('habits');
      },
      { timeout: 2000 }
    );
  }

  // Performance monitoring
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Monitor view switch performance
    let viewSwitchCount = 0;
    const originalSetActiveView = setActiveView;
    setActiveView = async function (...args) {
      viewSwitchCount++;
      const start = performance.now();
      await originalSetActiveView.apply(this, args);
      const duration = performance.now() - start;

      if (viewSwitchCount > 1) {
        // Skip first load - performance logging for development
      }
    };
  }
}
