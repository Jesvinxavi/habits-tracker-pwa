// layoutHelpers.js - Layout calculations and responsive helpers for home view
import { appData } from '../../core/state.js';

/**
 * Adjusts the habits container height for mobile responsiveness
 */
export function adjustHabitsContainerHeight() {
  if (typeof window === 'undefined') return;

  const container = document.querySelector('.habits-container');
  if (!container) return;

  const rect = container.getBoundingClientRect();
  // Subtract bottom padding (e.g. from pb-20 on .content-area) so last items are fully visible
  let bottomPadding = 0;
  const content = container.closest('.content-area');
  if (content) {
    const cs = window.getComputedStyle(content);
    bottomPadding = parseFloat(cs.paddingBottom) || 0;
  }
  const available = window.innerHeight - rect.top - bottomPadding;
  if (available > 0) {
    container.style.maxHeight = available + 'px';
    container.style.overflowY = 'auto';
  }
}

/**
 * Sets up responsive behavior for the home view
 */
export function setupResponsiveBehavior() {
  // Adjust habits container height for mobile
  adjustHabitsContainerHeight();

  // Listen for window resize
  window.addEventListener('resize', () => {
    adjustHabitsContainerHeight();
  });
}

/**
 * Centers an element horizontally in its container
 */
export function centerElementHorizontally(element) {
  if (!element || !element.parentElement) return;

  const container = element.parentElement;
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  const scrollLeft =
    container.scrollLeft +
    (elementRect.left - containerRect.left) -
    (containerRect.width - elementRect.width) / 2;

  container.scrollLeft = scrollLeft;
}
