import { dispatch, Actions, getState } from '../core/state.js';
import { isCloudBackend } from './dataBackend.js';
import { nextPaint } from '../shared/nextPaint.js';

export async function initializeNavigation() {
  const tabItems = document.querySelectorAll('.tab-item');
  const views = document.querySelectorAll('.view');

  // Module loading state tracking
  const moduleStates = {
    home: { loaded: false, loading: false, error: null, promise: null },
    habits: { loaded: false, loading: false, error: null, promise: null },
    fitness: { loaded: false, loading: false, error: null, promise: null },
    stats: { loaded: false, loading: false, error: null, promise: null },
    profile: { loaded: false, loading: false, error: null, promise: null },
  };
  let navigationRequest = 0;

  function ensureView(viewId) {
    let el = document.getElementById(viewId);
    if (!el) {
      el = document.createElement('div');
      el.id = viewId;
      el.className = 'view w-full h-full flex flex-col overflow-hidden';
      document.querySelector('main.content-area')?.appendChild(el);
    }
    return el;
  }

  // Generic module loader
  async function loadModule(moduleName) {
    const state = moduleStates[moduleName];
    if (!state || state.loaded) return;
    if (state.promise) return state.promise;

    state.loading = true;
    state.error = null;
    state.promise = (async () => {
      switch (moduleName) {
        case 'home': {
          const { HomeModule } = await import('../features/home/HomeModule.js');
          await HomeModule.init();
          break;
        }
        case 'habits': {
          const { HabitsModule } = await import('../features/habits/HabitsModule.js');
          await HabitsModule.init();
          break;
        }
        case 'fitness': {
          const { FitnessModule } = await import('../features/fitness/FitnessModule.js');
          await FitnessModule.init();
          break;
        }
        case 'stats': {
          const stats = await import('../features/stats/stats.js');
          await stats.initializeStats();
          break;
        }
        case 'profile': {
          const { ProfileModule } = await import('../features/profile/ProfileModule.js');
          await ProfileModule.init();
          break;
        }
        default:
          return;
      }
      state.loaded = true;
    })()
      .catch((error) => {
        state.error = error;
        console.error(`Error loading ${moduleName} module:`, error);
        throw error;
      })
      .finally(() => {
        state.loading = false;
        state.promise = null;
      });

    return state.promise;
  }

  function getModuleName(viewId) {
    return viewId?.replace('-view', '') || null;
  }

  function setNavigationBusy(viewId, isBusy) {
    const view = document.getElementById(viewId);
    const tab = Array.from(tabItems).find((item) => item.dataset.view === viewId);
    view?.setAttribute('aria-busy', String(isBusy));
    tab?.classList.toggle('is-loading', isBusy);
    tab?.setAttribute('aria-busy', String(isBusy));
  }

  function animateViewEntry(view) {
    if (!view) return;
    view.classList.remove('view-entering');
    void view.offsetWidth;
    view.classList.add('view-entering');
    view.addEventListener('animationend', () => view.classList.remove('view-entering'), {
      once: true,
    });
  }

  // Enhanced view switching with performance monitoring
  async function setActiveView(viewId) {
    const requestId = ++navigationRequest;
    const targetView = ensureView(viewId);
    const moduleName = getModuleName(viewId);
    const wasLoaded = moduleStates[moduleName]?.loaded;

    // Mount lazy pages at their real viewport dimensions while keeping partial
    // DOM invisible. The current page stays on screen until the target is ready.
    if (!wasLoaded && !targetView.classList.contains('active-view')) {
      targetView.classList.add('view-preparing');
    }
    setNavigationBusy(viewId, !wasLoaded);

    try {
      await loadModule(moduleName);
    } catch {
      targetView.classList.remove('view-preparing');
      setNavigationBusy(viewId, false);
      return;
    }

    targetView.classList.remove('view-preparing');
    setNavigationBusy(viewId, false);
    if (requestId !== navigationRequest) return;

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
        const isActive = item.dataset.view === viewId;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-selected', String(isActive));
      });
    };

    if (!isCloudBackend()) localStorage.setItem('activeHabitTrackerTab', viewId);
    if (viewId === 'home-view' || viewId === 'fitness-view') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (viewId === 'home-view') {
        // Calculate the appropriate "today" using centralized smart date selection
        const currentGroup = getState().selectedGroup || 'daily';
        const { calculateSmartDateForGroupISO } = await import('../shared/dateSelection.js');
        
        const appropriateTodayISO = calculateSmartDateForGroupISO(getState().habits, currentGroup, today);
        
        // Update the state with the appropriate date for the current group
        dispatch(Actions.setSelectedDate(appropriateTodayISO));
      } else if (viewId === 'fitness-view') {
        const { getLocalMidnightISOString } = await import('../shared/datetime.js');
        const localToday = getLocalMidnightISOString(today);
        dispatch(Actions.setFitnessSelectedDate(localToday));
      }
    }

    // Paint, swap the views, then let that land. Awaiting raw frames here
    // stalled startup completely in a hidden tab: the view never switched, so
    // initializeNavigation never returned and the loading screen never lifted.
    await nextPaint();
    updateViews();
    animateViewEntry(targetView);
    await nextPaint();

    // Calendars need one visible frame before their final centering pass.
    if (viewId === 'home-view') {
      window.HomeModule?.refresh?.();
      document
        .querySelector('#home-view hh-calendar[state-key="selectedDate"]')
        ?.scrollToSelected?.({ instant: !wasLoaded });
    } else if (viewId === 'fitness-view') {
      const calendar = document.querySelector(
        '#fitness-view hh-calendar[state-key="fitnessSelectedDate"]'
      );
      calendar?.refresh?.();
      calendar?.scrollToSelected?.({ instant: !wasLoaded });
    }
  }

  // Force Home on startup (ignore saved tab)
  await setActiveView('home-view');

  // Also enforce Home once per cold start (covers PWA session restore)
  try {
    if (!sessionStorage.getItem('bootForcedHome')) {
      sessionStorage.setItem('bootForcedHome', '0');
    }
    window.addEventListener('pageshow', () => {
      try {
        if (sessionStorage.getItem('bootForcedHome') !== '1') {
          void setActiveView('home-view');
          sessionStorage.setItem('bootForcedHome', '1');
        }
      } catch (error) {
        console.warn('Failed to handle pageshow event:', error);
      }
    });
  } catch (error) {
    console.warn('Failed to initialize bootForcedHome:', error);
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

  function prefetchModule(moduleName) {
    const prefetchState = `_${moduleName}Prefetched`;
    if (window[prefetchState] || moduleStates[moduleName]?.loaded) return null;

    window[prefetchState] = true;

    // Fire and forget – this will cache the chunks
    let importPromise;
    switch (moduleName) {
      case 'home':
        importPromise = import('../features/home/HomeModule.js');
        break;
      case 'habits':
        importPromise = import('../features/habits/HabitsModule.js');
        break;
      case 'fitness':
        importPromise = Promise.all([
          import('../features/fitness/FitnessModule.js'),
          import('../features/fitness/RestToggle.js'),
        ]);
        break;
      case 'stats':
        importPromise = import('../features/stats/stats.js');
        break;
      case 'profile':
        importPromise = import('../features/profile/ProfileModule.js');
        break;
      default:
        return null;
    }

    importPromise.catch((err) => {
      console.warn(`Failed to prefetch ${moduleName} module:`, err);
      window[prefetchState] = false; // Reset on error
    });
    return importPromise;
  }

  // Pointer-down runs before click on touchscreens, giving mobile navigation a
  // useful head start. Pointer-enter retains the desktop hover optimization.
  document.querySelectorAll('.tab-item[data-view]').forEach((tab) => {
    const moduleName = tab.dataset.view.replace('-view', '');
    if (moduleName) {
      tab.addEventListener('pointerdown', () => prefetchModule(moduleName), { once: true });
      tab.addEventListener('pointerenter', () => prefetchModule(moduleName), { once: true });
    }
  });

  // Prefetch when page becomes hidden (user likely to come back soon)
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      prefetchModule('home');
      prefetchModule('habits');
      prefetchModule('fitness');
      prefetchModule('stats');
    }
  });

  // Warm every top-level page after Home is interactive. This downloads code
  // only; it does not initialize hidden features or extend the startup loader.
  if ('requestIdleCallback' in window) {
    requestIdleCallback(
      () => {
        prefetchModule('habits');
        prefetchModule('fitness');
        prefetchModule('stats');
        prefetchModule('profile');
      },
      { timeout: 1200 }
    );
  } else {
    setTimeout(() => {
      prefetchModule('habits');
      prefetchModule('fitness');
      prefetchModule('stats');
      prefetchModule('profile');
    }, 250);
  }
}
