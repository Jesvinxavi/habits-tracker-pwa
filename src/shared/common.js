/**
 * Common utility functions used across the application
 * Centralized location for frequently used helpers
 */

/**
 * Debounce function to limit the rate of function calls
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds (default: 300)
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function to limit the rate of function calls
 * @param {Function} fn - Function to throttle
 * @param {number} delay - Delay in milliseconds (default: 300)
 * @returns {Function} Throttled function
 */
export function throttle(fn, delay = 300) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return fn(...args);
    }
  };
}

/**
 * Memoization function for expensive computations
 * @param {Function} fn - Function to memoize
 * @param {Function} keyFn - Function to generate cache key (optional)
 * @returns {Function} Memoized function
 */
export function memoize(fn, keyFn = (...args) => JSON.stringify(args)) {
  const cache = new Map();
  return (...args) => {
    const key = keyFn(...args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * RequestAnimationFrame wrapper for smooth animations
 * @param {Function} callback - Function to execute on next frame
 * @returns {number} Request ID
 */
export function raf(callback) {
  return requestAnimationFrame(callback);
}

/**
 * Cancel animation frame wrapper
 * @param {number} id - Request ID to cancel
 */
export function cancelRaf(id) {
  cancelAnimationFrame(id);
}

/**
 * Intersection Observer utility for lazy loading
 * @param {Element} element - Element to observe
 * @param {Function} callback - Callback when element intersects
 * @param {Object} options - IntersectionObserver options
 * @returns {IntersectionObserver} Observer instance
 */
export function observeElement(element, callback, options = {}) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          callback(entry);
          observer.unobserve(entry.target);
        }
      });
    },
    {
      rootMargin: '50px',
      threshold: 0.1,
      ...options,
    }
  );

  observer.observe(element);
  return observer;
}

/**
 * Performance measurement utility
 * @param {string} label - Label for the measurement
 * @param {Function} fn - Function to measure
 * @returns {any} Result of the function
 */
export function measurePerformance(label, fn) {
  const result = fn();

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Debug logging removed for production
  }

  return result;
}

/**
 * Batch DOM updates for better performance
 * @param {Function} updateFn - Function containing DOM updates
 */
export function batchDOMUpdates(updateFn) {
  // Use requestAnimationFrame to batch updates
  raf(() => {
    // Temporarily disable layout thrashing
    const style = document.body.style;
    const originalDisplay = style.display;
    style.display = 'none';

    updateFn();

    // Re-enable display
    raf(() => {
      style.display = originalDisplay;
    });
  });
}

/**
 * Virtual scrolling helper for large lists
 * @param {Array} items - Array of items
 * @param {number} itemHeight - Height of each item
 * @param {number} containerHeight - Height of container
 * @param {number} scrollTop - Current scroll position
 * @returns {Object} Visible range and items
 */
export function getVisibleRange(items, itemHeight, containerHeight, scrollTop) {
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + Math.ceil(containerHeight / itemHeight) + 1, items.length);

  return {
    startIndex,
    endIndex,
    visibleItems: items.slice(startIndex, endIndex),
    offsetY: startIndex * itemHeight,
  };
}

/**
 * Generate unique ID with better performance than UUID
 * @returns {string} Unique ID
 */
export function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Capitalize first letter of string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format muscle name for display
 * @param {string} muscleName - Raw muscle name
 * @returns {string} Formatted muscle name
 */
export function formatMuscleName(muscleName) {
  return muscleName
    .split('_')
    .map((word) => capitalize(word))
    .join(' ');
}

/**
 * Deep clone an object using JSON methods
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof Array) return obj.map(deepClone);
  if (typeof obj === 'object') {
    const cloned = {};
    Object.keys(obj).forEach((key) => {
      cloned[key] = deepClone(obj[key]);
    });
    return cloned;
  }
  return obj;
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 * @param {any} value - Value to check
 * @returns {boolean} True if empty
 */
export function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Safe JSON parse with fallback
 * @param {string} str - JSON string to parse
 * @param {any} fallback - Fallback value if parsing fails
 * @returns {any} Parsed value or fallback
 */
export function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Safe JSON stringify with fallback
 * @param {any} obj - Object to stringify
 * @param {string} fallback - Fallback string if stringifying fails
 * @returns {string} Stringified value or fallback
 */
export function safeJsonStringify(obj, fallback = '{}') {
  try {
    return JSON.stringify(obj);
  } catch {
    return fallback;
  }
}
