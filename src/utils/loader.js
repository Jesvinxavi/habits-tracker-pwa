// Initialize loading state
document.documentElement.classList.add('js-loading');

// Export function to remove loading state (used by autoToday.js)
export function removeLoadingState() {
  document.documentElement.classList.remove('js-loading');
}
