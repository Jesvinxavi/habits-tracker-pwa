// Initialize loading state
document.documentElement.classList.add('js-loading');

// Fallback: Remove loading state after 10 seconds if it hasn't been removed already
setTimeout(() => {
  if (document.documentElement.classList.contains('js-loading')) {
    console.warn('App initialization took longer than expected, showing fallback');
    removeLoadingState();
  }
}, 10000);

// Export function to remove loading state (used by autoToday.js)
export function removeLoadingState() {
  // Add a small delay to ensure all components are ready
  setTimeout(() => {
    // Remove the loading class to show the main app
    document.documentElement.classList.remove('js-loading');
    
    // Optional: Remove the loading screen element from DOM after transition
    const loadingScreen = document.getElementById('app-loading-screen');
    if (loadingScreen) {
      setTimeout(() => {
        loadingScreen.remove();
      }, 300); // Wait for CSS transition to complete
    }
  }, 100);
}
