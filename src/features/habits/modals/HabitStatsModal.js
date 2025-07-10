/**
 * Habit Statistics Modal
 *
 * Modal UI functionality for displaying habit statistics
 * Extracted from HabitsListModule.js for better modularity
 */

import { getState } from '../../../core/state.js';
import { calculateHabitStatistics } from '../helpers/habitStats.js';
import { formatLastPerformed } from '../../../shared/datetime.js';

// Global variable to track active carousel interval
let activeCarouselInterval = null;

/**
 * Handle habit stats click - calculate and show modal
 * @param {string} habitId - The ID of the habit
 */
export function handleHabitStatsClick(habitId) {
  const habit = getState().habits.find((h) => h.id === habitId);
  if (!habit) return;

  // Calculate habit statistics
  const stats = calculateHabitStatistics(habitId);

  // Open stats modal with calculated data
  openHabitStatsModal(habit, stats);
}

/**
 * Opens the habit statistics modal with calculated data
 * @param {Object} habit - The habit object
 * @param {Object} stats - The calculated statistics
 */
export function openHabitStatsModal(habit, stats) {
  const category = getState().categories.find((c) => c.id === habit.categoryId);
  const content = buildHabitStatsContent(habit, stats, category);

  const modalHTML = `
    <div id="habit-stats-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div class="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full flex items-center justify-center text-xl" style="background: ${category?.color || '#888'}; color: white;">
                ${habit.icon || '📋'}
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${habit.name}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">${category?.name || 'Uncategorized'}</p>
              </div>
            </div>
            <button id="close-habit-stats-modal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
              <span class="material-icons">close</span>
            </button>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto p-6">
          ${content}
        </div>
      </div>
    </div>
  `;

  // Remove existing modal if any
  const existingModal = document.getElementById('habit-stats-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Add modal to body
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Get modal elements
  const modal = document.getElementById('habit-stats-modal');
  const closeBtn = document.getElementById('close-habit-stats-modal');

  // Close modal function
  const closeModal = () => {
    // Clear any active carousel interval
    if (activeCarouselInterval) {
      clearInterval(activeCarouselInterval);
      activeCarouselInterval = null;
    }
    
    if (modal) {
      modal.classList.add('hidden');
      setTimeout(() => modal.remove(), 300);
    }
  };

  // Event listeners
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  // Show modal
  if (modal) {
    modal.classList.remove('hidden');
  }

  // Initialize carousel after modal is shown
  setTimeout(() => {
    initializeHabitCompletionCarousel(modal);
  }, 300);
}

/**
 * Builds the habit statistics content HTML
 * @param {Object} habit - The habit object
 * @param {Object} stats - The calculated statistics
 * @param {Object} category - The habit category
 * @returns {string} HTML string for the statistics content
 */
export function buildHabitStatsContent(habit, stats, category) {
  if (!stats || stats.daysTracked === 0) {
    return `
      <div class="text-center py-8">
        <span class="material-icons text-4xl text-gray-400 mb-4">bar_chart</span>
        <p class="text-gray-600 dark:text-gray-400">No data available yet</p>
        <p class="text-sm text-gray-500 mt-2">Start completing this habit to see statistics</p>
      </div>
    `;
  }

  let content = `
    <div class="stats-grid space-y-4">
      <!-- Overview Stats -->
      <div class="stats-section">
        <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Overview</h4>
        <div class="grid grid-cols-2 gap-4">
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-2xl font-bold text-gray-900 dark:text-white">${stats.totalCompletions}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Total Completions</div>
          </div>
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-2xl font-bold text-gray-900 dark:text-white">${stats.weeklyAverage.toFixed(1)}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Per Week Average</div>
          </div>
        </div>
      </div>
  `;

  // Completion rates section with carousel
  const completionPeriods = [
    {
      days: 7,
      label: '7d',
      rate: stats.completionRate7d,
    },
    {
      days: 30,
      label: '30d',
      rate: stats.completionRate30d,
    },
    {
      days: stats.daysTracked,
      label: 'All Time',
      rate: stats.completionRateTotal,
    },
  ];

  const completionCarouselHTML = renderHabitCompletionCarousel(completionPeriods);

  content += `
    <div class="stats-section">
      <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Completion Rates</h4>
      ${completionCarouselHTML}
      <div class="grid grid-cols-2 gap-4 mt-4">
        <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
          <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${stats.daysTracked}</div>
          <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Days Tracked</div>
        </div>
        <div class="stat-card bg-orange-50 dark:bg-orange-900 p-3 rounded-lg">
          <div class="stat-value text-xl font-bold text-orange-600 dark:text-orange-300">${stats.totalSkipped}</div>
          <div class="stat-label text-xs text-orange-600 dark:text-orange-300">Times Skipped</div>
          <div class="stat-sublabel text-xs text-orange-500 dark:text-orange-400 mt-1">
            ${stats.skippedPercentage.toFixed(1)}% of actions
          </div>
        </div>
      </div>
    </div>
  `;

  // Streaks section
  content += `
    <div class="stats-section">
      <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Streaks</h4>
      <div class="grid grid-cols-2 gap-4">
        <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
          <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${stats.currentStreak}</div>
          <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Current Streak</div>
        </div>
        <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
          <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${stats.longestStreak}</div>
          <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Longest Streak</div>
        </div>
      </div>
    </div>
  `;

  // Recent activity
  const lastCompletedText = stats.lastCompleted 
    ? formatLastPerformed(stats.lastCompleted)
    : 'Never';

  content += `
    <div class="stats-section">
      <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Recent Activity</h4>
      <div class="grid grid-cols-2 gap-4">
        <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
          <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${stats.recentActivity}</div>
          <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Last 30 Days</div>
        </div>
        <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
          <div class="stat-value text-sm font-bold text-gray-900 dark:text-white break-words">${lastCompletedText}</div>
          <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Last Completed</div>
        </div>
      </div>
    </div>
  `;

  content += '</div>';
  return content;
}

/**
 * Render completion carousel for individual habit statistics
 * @param {Array} periods - Array of period objects with rate data
 * @returns {string} HTML string for the carousel
 */
export function renderHabitCompletionCarousel(periods) {
  if (periods.length === 1) {
    // Single period - render simple tile
    const period = periods[0];
    return `
      <div class="completion-rates">
        <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
          <div class="text-xl font-bold text-center mb-1 text-gray-900 dark:text-white">
            ${period.rate.toFixed(1)}%
          </div>
          <div class="text-center text-xs text-gray-500 dark:text-gray-400">
            Completion Rate (${period.label})
          </div>
        </div>
      </div>
    `;
  }

  // Multiple periods - render carousel
  const slidesHTML = periods
    .map(
      (period, index) => `
    <div class="carousel-slide ${index === 0 ? 'active' : ''}" data-slide="${index}">
      <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
        <div class="text-xl font-bold text-center mb-1 text-gray-900 dark:text-white">
          ${period.rate.toFixed(1)}%
        </div>
        <div class="text-center text-xs text-gray-500 dark:text-gray-400">
          Completion Rate (${period.label})
        </div>
      </div>
    </div>
  `
    )
    .join('');

  const dotsHTML = periods
    .map(
      (_, index) => `
    <div class="carousel-dot ${index === 0 ? 'active' : ''}" data-slide="${index}"></div>
  `
    )
    .join('');

  return `
    <div class="completion-rates">
      <div class="completion-carousel" id="habit-completion-carousel">
        <div class="carousel-container">
          <div class="carousel-track" id="habit-carousel-track">
            ${slidesHTML}
          </div>
        </div>
        <div class="carousel-dots" id="habit-carousel-dots">
          ${dotsHTML}
        </div>
      </div>
    </div>
  `;
}

/**
 * Initialize habit completion carousel functionality
 * @param {Element} root - The root element to search within (default: document)
 */
export function initializeHabitCompletionCarousel(root = document) {
  // Look for the elements relative to the provided root. Using querySelector
  // keeps the logic unchanged while ensuring we only grab nodes inside the
  // habit-stats modal when it is provided as the root.
  const carousel = root.querySelector('.completion-carousel');
  const track = carousel ? carousel.querySelector('.carousel-track') : null;
  const dots = carousel ? carousel.querySelector('.carousel-dots') : null;

  if (!carousel || !track || !dots) return;

  const slides = track.querySelectorAll('.carousel-slide');
  const dotElements = dots.querySelectorAll('.carousel-dot');

  if (slides.length <= 1) return;

  let currentSlide = 0;
  let touchStartX = 0;
  let touchEndX = 0;

  // Update active slide and dot
  function updateActiveSlide(index) {
    if (index < 0 || index >= slides.length) return;

    currentSlide = index;

    // Update slides
    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === currentSlide);
    });

    // Update dots
    dotElements.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentSlide);
    });
  }

  // Go to next slide
  function nextSlide() {
    const next = (currentSlide + 1) % slides.length;
    updateActiveSlide(next);
  }

  // Go to previous slide
  function prevSlide() {
    const prev = (currentSlide - 1 + slides.length) % slides.length;
    updateActiveSlide(prev);
  }

  // Dot click handlers
  dotElements.forEach((dot, index) => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      updateActiveSlide(index);
    });
  });

  // Touch/swipe handlers
  carousel.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  });

  carousel.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].clientX;
    handleSwipe();
  });

  // Mouse drag handlers for desktop
  let isDragging = false;
  let startX = 0;

  carousel.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    carousel.style.cursor = 'grabbing';
  });

  carousel.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
  });

  carousel.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    carousel.style.cursor = 'grab';

    const endX = e.clientX;
    const diffX = startX - endX;

    if (Math.abs(diffX) > 50) {
      if (diffX > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  });

  function handleSwipe() {
    const swipeThreshold = 50;
    const diffX = touchStartX - touchEndX;

    if (Math.abs(diffX) > swipeThreshold) {
      if (diffX > 0) {
        nextSlide(); // Swipe left - next slide
      } else {
        prevSlide(); // Swipe right - previous slide
      }
    }
  }

  // Add CSS cursor
  carousel.style.cursor = 'grab';

  // --- Auto-scroll functionality ---
  // Clear any existing global interval
  if (activeCarouselInterval) {
    clearInterval(activeCarouselInterval);
  }
  
  // Start auto-scroll every 10 seconds
  activeCarouselInterval = setInterval(() => {
    nextSlide();
  }, 10000);

  // Pause auto-scroll on hover
  carousel.addEventListener('mouseenter', () => {
    if (activeCarouselInterval) {
      clearInterval(activeCarouselInterval);
      activeCarouselInterval = null;
    }
  });

  // Resume auto-scroll when mouse leaves (but only if not dragging)
  carousel.addEventListener('mouseleave', (e) => {
    // Handle dragging state
    if (isDragging) {
      isDragging = false;
      carousel.style.cursor = 'grab';
    }
    
    // Resume auto-scroll
    if (activeCarouselInterval) clearInterval(activeCarouselInterval);
    activeCarouselInterval = setInterval(() => {
      nextSlide();
    }, 10000);
  });
} 