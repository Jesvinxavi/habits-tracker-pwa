/**
 * Fitness Header Bar Component
 *
 * Component for building the fitness page header bar
 * Extracted from src/ui/fitness.js for better modularity
 */

/**
 * Mounts the header bar for the fitness view
 * @returns {HTMLElement} The header bar element
 */
export function mountHeaderBar() {
  // Create header identical to Habits page
  const header = document.createElement('header');
  header.className =
    'app-header flex justify-between items-center h-11 px-4 sm:px-6 lg:px-8 border-b border-gray-200 dark:border-gray-700 border-opacity-50 w-full';

  header.innerHTML = `
    <div></div>
    <h1 class="app-title text-center flex-grow text-[36px] font-extrabold leading-none flex items-end">Fitness</h1>
    <div></div>
  `;

  return header;
}
