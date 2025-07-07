/**
 * Performance monitoring and analytics utility
 * Tracks app performance metrics for optimization insights
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      pageLoad: {},
      moduleLoads: {},
      interactions: {},
      errors: [],
    };

    this.observers = new Map();
    this.isEnabled =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    this.init();
  }

  init() {
    if (!this.isEnabled) return;

    // Track initial page load
    this.trackPageLoad();

    // Track module loading times
    this.trackModuleLoads();

    // Track user interactions
    this.trackInteractions();

    // Track errors
    this.trackErrors();

    // Track memory usage
    this.trackMemoryUsage();
  }

  trackPageLoad() {
    if (typeof window === 'undefined') return;

    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');

      this.metrics.pageLoad = {
        domContentLoaded:
          navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
        loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
        firstPaint: paint.find((p) => p.name === 'first-paint')?.startTime,
        firstContentfulPaint: paint.find((p) => p.name === 'first-contentful-paint')?.startTime,
        totalLoadTime: navigation?.loadEventEnd - navigation?.fetchStart,
      };
    });
  }

  trackModuleLoads() {
    // Override dynamic imports to track loading times
    const originalImport = window.import;
    if (originalImport) {
      window.import = async (modulePath) => {
        const start = performance.now();
        try {
          const result = await originalImport(modulePath);
          const loadTime = performance.now() - start;

          this.metrics.moduleLoads[modulePath] = {
            loadTime,
            success: true,
            timestamp: Date.now(),
          };

          return result;
        } catch (error) {
          const loadTime = performance.now() - start;
          this.metrics.moduleLoads[modulePath] = {
            loadTime,
            success: false,
            error: error.message,
            timestamp: Date.now(),
          };
          throw error;
        }
      };
    }
  }

  trackInteractions() {
    if (typeof window === 'undefined') return;

    // Track view switches
    this.observeViewSwitches();

    // Track modal interactions
    this.observeModalInteractions();

    // Track form submissions
    this.observeFormSubmissions();
  }

  observeViewSwitches() {
    const tabItems = document.querySelectorAll('.tab-item');
    tabItems.forEach((tab) => {
      tab.addEventListener('click', () => {
        const viewId = tab.dataset.view;
        this.recordInteraction('view_switch', {
          from: this.getCurrentView(),
          to: viewId,
          timestamp: Date.now(),
        });
      });
    });
  }

  observeModalInteractions() {
    // Track modal open/close events
    const modalObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains('modal')) {
            this.recordInteraction('modal_open', {
              modalId: node.id,
              timestamp: Date.now(),
            });
          }
        });

        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains('modal')) {
            this.recordInteraction('modal_close', {
              modalId: node.id,
              timestamp: Date.now(),
            });
          }
        });
      });
    });

    modalObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  observeFormSubmissions() {
    document.addEventListener('submit', (event) => {
      this.recordInteraction('form_submit', {
        formId: event.target.id,
        timestamp: Date.now(),
      });
    });
  }

  trackErrors() {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      this.metrics.errors.push({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        timestamp: Date.now(),
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.metrics.errors.push({
        type: 'unhandledrejection',
        reason: event.reason,
        timestamp: Date.now(),
      });
    });
  }

  trackMemoryUsage() {
    if (typeof performance.memory === 'undefined') return;

    setInterval(() => {
      const memory = performance.memory;
      const memoryUsage = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
        timestamp: Date.now(),
      };

      if (memoryUsage.percentage > 80) {
        console.warn('⚠️ High memory usage:', memoryUsage.percentage.toFixed(1) + '%');
      }
    }, 30000); // Check every 30 seconds
  }

  recordInteraction(type, data) {
    if (!this.metrics.interactions[type]) {
      this.metrics.interactions[type] = [];
    }

    this.metrics.interactions[type].push(data);

    if (this.metrics.interactions[type].length > 100) {
      this.metrics.interactions[type] = this.metrics.interactions[type].slice(-50);
    }
  }

  getCurrentView() {
    const activeView = document.querySelector('.view.active-view');
    return activeView?.id || 'unknown';
  }

  getMetrics() {
    return {
      ...this.metrics,
      summary: this.generateSummary(),
    };
  }

  generateSummary() {
    const moduleLoads = Object.values(this.metrics.moduleLoads);
    const avgModuleLoadTime =
      moduleLoads.length > 0
        ? moduleLoads.reduce((sum, m) => sum + m.loadTime, 0) / moduleLoads.length
        : 0;

    const viewSwitches = this.metrics.interactions.view_switch || [];
    const avgViewSwitchTime =
      viewSwitches.length > 0
        ? viewSwitches.reduce((sum, v) => sum + (v.duration || 0), 0) / viewSwitches.length
        : 0;

    return {
      totalModulesLoaded: moduleLoads.length,
      averageModuleLoadTime: avgModuleLoadTime,
      totalViewSwitches: viewSwitches.length,
      averageViewSwitchTime: avgViewSwitchTime,
      totalErrors: this.metrics.errors.length,
      uptime: Date.now() - (this.metrics.pageLoad.timestamp || Date.now()),
    };
  }

  exportMetrics() {
    return JSON.stringify(this.getMetrics(), null, 2);
  }

  clearMetrics() {
    this.metrics = {
      pageLoad: {},
      moduleLoads: {},
      interactions: {},
      errors: [],
    };
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
export { PerformanceMonitor };
