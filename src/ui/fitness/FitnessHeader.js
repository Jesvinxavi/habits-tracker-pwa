/**
 * FitnessHeader - Header component for fitness view
 * Handles header bar, action buttons, and search functionality
 */

import { openModal } from '../../components/Modal.js';

/**
 * Builds the header bar with title
 */
export function buildHeaderBar() {
  const fitnessView = document.getElementById('fitness-view');
  if (!fitnessView) return;

  // Create header identical to Habits page
  const header = document.createElement('header');
  header.className =
    'app-header flex justify-between items-center h-11 px-4 sm:px-6 lg:px-8 border-b border-gray-200 dark:border-gray-700 border-opacity-50 w-full';

  header.innerHTML = `
    <div></div>
    <h1 class="app-title text-center flex-grow text-[36px] font-extrabold leading-none flex items-end">Fitness</h1>
    <div></div>
  `;

  fitnessView.appendChild(header);
}

/**
 * Builds the action buttons row (New Activity + Start Timer)
 */
export function buildActionButtons() {
  const fitnessView = document.getElementById('fitness-view');
  if (!fitnessView) return;

  // Add Action Buttons row (like Habits page)
  const actionButtonsRow = document.createElement('div');
  actionButtonsRow.className = 'action-buttons flex gap-3 mb-1 px-4 pt-1';
  actionButtonsRow.innerHTML = `
    <button id="new-activity-btn" class="flex-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 py-1.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      New Activity
    </button>
    <button id="start-timer-btn" class="flex-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 py-1.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2">
      <span class="material-icons text-xl">schedule</span>
      Timer
    </button>
  `;
  fitnessView.appendChild(actionButtonsRow);

  // Make button text bold like habits page
  actionButtonsRow.querySelectorAll('#new-activity-btn, #start-timer-btn').forEach((btn) => {
    btn.classList.add('font-semibold');
  });
}

/**
 * Builds the search bar with expandable activities section
 */
export function buildSearchBar() {
  const fitnessView = document.getElementById('fitness-view');
  if (!fitnessView) return;

  // Add Search Bar container with expandable section
  const searchContainer = document.createElement('div');
  searchContainer.className = 'search-container px-4';
  searchContainer.innerHTML = `
    <div class="search-input relative border-2 border-gray-300 dark:border-gray-500 rounded-xl">
      <svg class="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <input id="fitness-activity-search" type="text" placeholder="Search activities..." class="w-full pl-10 pr-10 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl border-none outline-none focus:bg-white dark:focus:bg-gray-600 transition-colors cursor-pointer" autocomplete="off" spellcheck="false">
      <button id="close-search-btn" class="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors hidden">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    
    <!-- Expandable Activities Section -->
    <div id="activities-search-section" class="activities-search-section hidden bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-500 rounded-xl mt-2 overflow-hidden transition-all duration-300 ease-in-out">
      <div class="activities-search-content p-4 overflow-y-auto">
        <!-- Content will be populated dynamically -->
      </div>
    </div>
  `;
  fitnessView.appendChild(searchContainer);
}

/**
 * Builds the complete header for the fitness view
 */
export function buildHeader() {
  const fitnessView = document.getElementById('fitness-view');
  if (!fitnessView) return;

  // Clear any existing content
  fitnessView.innerHTML = '';

  buildHeaderBar();
  buildActionButtons();
  buildSearchBar();
}

/**
 * Binds action button events
 */
export function bindActionButtons() {
  const newActivityBtn = document.getElementById('new-activity-btn');
  if (newActivityBtn) {
    newActivityBtn.addEventListener('click', () => {
      openModal('add-activity-modal');
    });
  }

  const startTimerBtn = document.getElementById('start-timer-btn');
  if (startTimerBtn) {
    startTimerBtn.addEventListener('click', () => {
      import('./FitnessTimer.js').then((module) => {
        module.openTimerModal();
      });
    });
  }
}
