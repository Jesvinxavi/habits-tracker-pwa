import { dispatch, Actions } from '../core/state.js';

export function initializeNavigation() {
  const tabItems = document.querySelectorAll('.tab-item');
  const views = document.querySelectorAll('.view');

  const PLACEHOLDER_TEMPLATES = {
    'fitness-view': 'fitness-view-placeholder',
    'stats-view': 'stats-view-placeholder',
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
      el = document.createElement('div');
      el.id = viewId;
      el.className = 'view w-full h-full flex flex-col overflow-hidden';
      document.querySelector('main.content-area')?.appendChild(el);
    }
    if (el.childElementCount === 0 && PLACEHOLDER_TEMPLATES[viewId]) {
      const template = document.getElementById(PLACEHOLDER_TEMPLATES[viewId]);
      if (template) {
        el.appendChild(template.content.cloneNode(true));
      }
    }
  }

  // Generic module loader
  async function loadModule(moduleName) {
    if (moduleStates[moduleName].loaded || moduleStates[moduleName].loading) return;
    moduleStates[moduleName].loading = true;
    let viewId, spinnerId, templateId;
    switch (moduleName) {
      case 'home':
        viewId = 'home-view';
        spinnerId = 'home-loading';
        templateId = 'home-loading-spinner';
        try {
          const { HomeModule } = await import('../features/home/HomeModule.js');
          await HomeModule.init();
        } catch (error) {
          console.error('Error loading home module:', error);
          moduleStates[moduleName].error = error;
        }
        break;
      case 'habits':
        viewId = 'habits-view';
        spinnerId = 'habits-loading';
        templateId = 'habits-loading-spinner';
        try {
          const { HabitsModule } = await import('../features/habits/HabitsModule.js');
          await HabitsModule.init();
        } catch (error) {
          console.error('Error loading habits module:', error);
          moduleStates[moduleName].error = error;
        }
        break;
      case 'fitness':
        viewId = 'fitness-view';
        spinnerId = null; // No spinner template for fitness yet
        templateId = null;
        try {
          const { FitnessModule } = await import('../features/fitness/FitnessModule.js');
          await FitnessModule.init();
        } catch (error) {
          console.error('Error loading fitness module:', error);
          moduleStates[moduleName].error = error;
        }
        break;
      case 'stats':
        viewId = 'stats-view';
        spinnerId = null; // No spinner template for stats yet
        templateId = null;
        try {
          const stats = await import('../features/stats/stats.js');
          await stats.initializeStats();
        } catch (error) {
          console.error('Error loading stats module:', error);
          moduleStates[moduleName].error = error;
        }
        break;
      default:
        return;
    }
    const view = document.getElementById(viewId);
    if (view && spinnerId && !view.querySelector(`#${spinnerId}`) && templateId) {
      const template = document.getElementById(templateId);
      if (template) {
        const spinner = template.content.cloneNode(true).firstElementChild;
        view.appendChild(spinner);
        // remove spinner once loaded
        setTimeout(() => spinner.remove(), 500);
      }
    }
    moduleStates[moduleName].loaded = true;
    moduleStates[moduleName].loading = false;
  }

  // Enhanced view switching with performance monitoring
  async function setActiveView(viewId) {
    ensurePlaceholder(viewId);
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
          
          // Clean up any search-related state when switching away from fitness view
          if (view.id === 'fitness-view') {
            view.classList.remove('search-expanded');
          }
        }
      });
      tabItems.forEach((item) => {
        item.classList.toggle('active', item.dataset.view === viewId);
      });
    };
    requestAnimationFrame(updateViews);
    localStorage.setItem('activeHabitTrackerTab', viewId);
    if (viewId === 'home-view' || viewId === 'fitness-view') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (viewId === 'home-view') {
        const calEl = document.querySelector('#home-view hh-calendar[state-key="selectedDate"]');
        calEl?.setDate?.(today, { smooth: true });
        window.HomeModule?.refresh?.();
      } else if (viewId === 'fitness-view') {
        const { getLocalMidnightISOString } = await import('../shared/datetime.js');
        const localToday = getLocalMidnightISOString(today);
        dispatch(Actions.setFitnessSelectedDate(localToday));
        document
          .querySelector('#fitness-view hh-calendar[state-key="fitnessSelectedDate"]')
          ?.refresh?.();
      }
    }
    // Use generic loader for all modules
    if (viewId === 'home-view') {
      await loadModule('home');
    } else if (viewId === 'habits-view') {
      await loadModule('habits');
    } else if (viewId === 'fitness-view') {
      await loadModule('fitness');
    } else if (viewId === 'stats-view') {
      await loadModule('stats');
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

  // Advanced prefetching with intersection observer

  function prefetchModule(moduleName) {
    const prefetchState = `_${moduleName}Prefetched`;
    if (window[prefetchState] || moduleStates[moduleName]?.loaded) return;

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
        importPromise = import('../features/fitness/FitnessModule.js');
        break;
      case 'stats':
        importPromise = import('../features/stats/stats.js');
        break;
      default:
        return;
    }

    importPromise.catch((err) => {
      console.warn(`Failed to prefetch ${moduleName} module:`, err);
      window[prefetchState] = false; // Reset on error
    });
  }

  // Prefetch when tabs are hovered
  document.querySelectorAll('.tab-item[data-view]').forEach(tab => {
    const moduleName = tab.dataset.view.replace('-view', '');
    if (moduleName) {
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
}
