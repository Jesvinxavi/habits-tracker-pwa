import { appData } from '../core/state.js';

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
    'food-view': `
      <header class="app-header flex justify-between items-center h-11 px-4 sm:px-6 lg:px-8 border-b border-gray-200 dark:border-gray-700 w-full">
        <button class="back-btn text-ios-blue text-lg lg:text-xl">←</button>
        <h1 class="app-title text-lg font-semibold lg:text-xl">Food Log</h1>
        <button class="add-btn text-ios-blue text-2xl lg:text-3xl">+</button>
      </header>
      <div class="placeholder-content text-center py-16 px-4 sm:px-6 lg:px-8 text-gray-500">
        <div class="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center lg:w-20 lg:h-20">
          <svg class="w-8 h-8 lg:w-10 lg:h-10" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd"/>
          </svg>
        </div>
        <p class="text-lg font-medium lg:text-xl">Food logging will be built here</p>
      </div>`,
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

  // Lazy-load heavy Habits view bundle on first activation
  let _habitsLoaded = false;

  async function loadHabitsModules() {
    if (_habitsLoaded) return;
    _habitsLoaded = true;

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
        <p class="text-sm">Loading…</p>`;
      habitsView.appendChild(spinner);
    }

    try {
      // Load views in parallel where possible
      const [{ init: initList }, { init: initCategories }, { init: initReorder }] =
        await Promise.all([
          import('../views/HabitsListView.js'),
          import('../views/CategoriesView.js'),
          import('../views/ReorderView.js'),
        ]);

      // Initialize categories first (dropdowns / buttons), then list, then search & reorder
      await initCategories();
      await initList();

      // Search needs the DOM produced by list
      import('../ui/habits/search.js').then((m) => m.initializeSearch());

      // Reorder needs list DOM too
      initReorder();
    } catch (error) {
      console.error('Error loading habits modules:', error);
    }

    // Remove spinner once everything is ready
    spinner?.remove();
  }

  async function setActiveView(viewId) {
    ensurePlaceholder(viewId);

    const targetView = document.getElementById(viewId);

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
      const wasActive = item.classList.contains('active');
      item.classList.toggle('active', item.dataset.view === viewId);
      const isActive = item.classList.contains('active');
    });
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

    // Trigger lazy load when Habits view becomes active
    if (viewId === 'habits-view') {
      loadHabitsModules();
    }
  }

  // Default view
  const savedView = localStorage.getItem('activeHabitTrackerTab') || 'home-view';

  setActiveView(savedView);

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

  // Dropdown now fully handled by Home view (src/ui/home.js)

  // ----- Prefetch Habits chunks when likely needed -----
  let _habitsPrefetched = false;
  function prefetchHabits() {
    if (_habitsPrefetched || _habitsLoaded) return;
    _habitsPrefetched = true;
    // Fire and forget – this will cache the chunks
    import('../views/HabitsListView.js');
    import('../views/CategoriesView.js');
    import('../views/ReorderView.js');
  }

  // Prefetch when the tab is hovered / focused
  const habitsTab = document.querySelector('.tab-item[data-view="habits-view"]');
  if (habitsTab) {
    habitsTab.addEventListener('pointerenter', prefetchHabits, { once: true });
  }

  // Prefetch when page becomes hidden (user likely to come back soon)
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') prefetchHabits();
  });
}
