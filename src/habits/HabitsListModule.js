import { appData, mutate } from '../core/state.js';
import { updateProgressRing } from '../components/ProgressRing.js';
import { getFrequencyText, getFrequencyIcon } from '../utils/habits.js';
import { hexToRgba } from '../utils/color.js';
import {
  toggleHabitCompleted as _toggleDone,
  isHabitCompleted,
  isHabitScheduledOnDate,
  belongsToSelectedGroup,
  isHabitSkippedToday,
} from '../home/schedule.js';
import { formatLastPerformed } from '../utils/datetime.js';

// ---------- Habit Statistics ----------

/**
 * Calculate statistics for a specific habit
 */
function calculateHabitStatistics(habitId) {
  const habit = appData.habits.find((h) => h.id === habitId);
  if (!habit) return null;

  const today = new Date();
  const stats = {
    totalCompletions: 0,
    currentStreak: 0,
    longestStreak: 0,
    completionRate7d: 0,
    completionRate30d: 0,
    completionRateTotal: 0,
    recentActivity: 0,
    lastCompleted: null,
    targetProgress: null,
    weeklyAverage: 0,
    daysTracked: 0,
    totalSkipped: 0,
    skippedPercentage: 0,
  };

  // Extract creation date from habit ID (timestamp + random string)
  let creationDate;
  if (typeof habit.id === 'string' && /^[0-9]{13}/.test(habit.id)) {
    const ts = parseInt(habit.id.slice(0, 13), 10);
    if (!Number.isNaN(ts)) {
      creationDate = new Date(ts);
    }
  }

  // Fallback to current date if we can't extract creation date
  if (!creationDate || isNaN(creationDate)) {
    creationDate = new Date();
  }

  // Calculate how many days the habit has existed (ensure it's at least 1)
  const daysSinceCreation = Math.max(
    1,
    Math.floor((today - creationDate) / (1000 * 60 * 60 * 24)) + 1
  );
  stats.daysTracked = daysSinceCreation;

  // Calculate completion rates for different periods
  stats.completionRate7d = calculateHabitCompletionRate(habit, 7);
  stats.completionRate30d = calculateHabitCompletionRate(habit, 30);
  stats.completionRateTotal = calculateHabitCompletionRate(habit, daysSinceCreation);

  // Calculate streaks
  stats.currentStreak = calculateCurrentStreak(habit);
  stats.longestStreak = calculateLongestStreak(habit);

  // Calculate recent activity (last 30 days)
  let recentCompletions = 0;
  for (let i = 0; i < Math.min(30, daysSinceCreation); i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    if (date < creationDate) continue;

    if (isHabitScheduledOnDate(habit, date) && isHabitCompleted(habit, date)) {
      recentCompletions++;
      if (!stats.lastCompleted || date > new Date(stats.lastCompleted)) {
        stats.lastCompleted = date.toISOString();
      }
    }
  }
  stats.recentActivity = recentCompletions;

  // Calculate total completions and skips
  let totalSkipped = 0;
  for (let i = 0; i < daysSinceCreation; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    if (date < creationDate) continue;

    if (isHabitScheduledOnDate(habit, date)) {
      if (isHabitCompleted(habit, date)) {
        stats.totalCompletions++;
      } else if (isHabitSkippedToday(habit, date)) {
        totalSkipped++;
      }
    }
  }
  stats.totalSkipped = totalSkipped;

  // Calculate skipped percentage against completions
  const totalActions = stats.totalCompletions + stats.totalSkipped;
  stats.skippedPercentage = totalActions > 0 ? (stats.totalSkipped / totalActions) * 100 : 0;

  // Calculate weekly average
  const weeksSinceCreation = daysSinceCreation / 7;
  stats.weeklyAverage = weeksSinceCreation > 0 ? stats.totalCompletions / weeksSinceCreation : 0;

  // Calculate target progress (for target-based habits)
  if (habit.target && typeof habit.target === 'number') {
    const targetFrequency = habit.targetFrequency || habit.frequency || 'daily';
    const completedToday = isHabitCompleted(habit, today);

    if (targetFrequency === 'daily') {
      stats.targetProgress = {
        completed: completedToday ? 1 : 0,
        target: habit.target,
        unit: habit.targetUnit || '',
        isComplete: completedToday,
      };
    }
  }

  return stats;
}

/**
 * Calculate completion rate for a specific habit over the last N days
 */
function calculateHabitCompletionRate(habit, days = 30) {
  const today = new Date();
  let completed = 0;
  let scheduled = 0;

  let creationDate;
  if (typeof habit.id === 'string' && /^[0-9]{13}/.test(habit.id)) {
    const ts = parseInt(habit.id.slice(0, 13), 10);
    if (!Number.isNaN(ts)) {
      creationDate = new Date(ts);
    }
  }

  // Fallback to current date if we can't extract creation date
  if (!creationDate || isNaN(creationDate)) {
    creationDate = new Date();
  }

  const daysToCheck = Math.min(
    days,
    Math.floor((today - creationDate) / (1000 * 60 * 60 * 24)) + 1
  );

  for (let i = 0; i < daysToCheck; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    if (date < creationDate) continue;

    if (isHabitScheduledOnDate(habit, date)) {
      scheduled++;
      if (isHabitCompleted(habit, date)) {
        completed++;
      }
    }
  }

  return scheduled > 0 ? (completed / scheduled) * 100 : 0;
}

/**
 * Calculate current streak for a habit
 */
function calculateCurrentStreak(habit) {
  const today = new Date();
  let streak = 0;
  let date = new Date(today);

  let creationDate;
  if (typeof habit.id === 'string' && /^[0-9]{13}/.test(habit.id)) {
    const ts = parseInt(habit.id.slice(0, 13), 10);
    if (!Number.isNaN(ts)) {
      creationDate = new Date(ts);
    }
  }

  // Fallback to current date if we can't extract creation date
  if (!creationDate || isNaN(creationDate)) {
    creationDate = new Date();
  }

  while (date >= creationDate) {
    if (isHabitScheduledOnDate(habit, date)) {
      if (isHabitCompleted(habit, date)) {
        streak++;
      } else {
        break;
      }
    }
    date.setDate(date.getDate() - 1);
  }

  return streak;
}

/**
 * Calculate longest streak for a habit
 */
function calculateLongestStreak(habit) {
  const today = new Date();
  let maxStreak = 0;
  let currentStreak = 0;

  let creationDate;
  if (typeof habit.id === 'string' && /^[0-9]{13}/.test(habit.id)) {
    const ts = parseInt(habit.id.slice(0, 13), 10);
    if (!Number.isNaN(ts)) {
      creationDate = new Date(ts);
    }
  }

  // Fallback to current date if we can't extract creation date
  if (!creationDate || isNaN(creationDate)) {
    creationDate = new Date();
  }

  const daysSinceCreation = Math.floor((today - creationDate) / (1000 * 60 * 60 * 24)) + 1;

  for (let i = daysSinceCreation - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    if (date < creationDate) continue;

    if (isHabitScheduledOnDate(habit, date)) {
      if (isHabitCompleted(habit, date)) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
  }

  return maxStreak;
}

/**
 * Handle stats button click - opens habit statistics modal
 */
function handleHabitStatsClick(habitId) {
  const habit = appData.habits.find((h) => h.id === habitId);
  if (!habit) return;

  // Calculate habit statistics
  const stats = calculateHabitStatistics(habitId);

  // Open stats modal with calculated data
  openHabitStatsModal(habit, stats);
}

/**
 * Opens the habit statistics modal with calculated data
 */
function openHabitStatsModal(habit, stats) {
  const category = appData.categories.find((c) => c.id === habit.categoryId);
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
    initializeHabitCompletionCarousel();
  }, 100);
}

/**
 * Builds the habit statistics content HTML
 */
function buildHabitStatsContent(habit, stats, category) {
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
  content += `
    <div class="stats-section">
      <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Recent Activity</h4>
      <div class="grid grid-cols-2 gap-4">
        <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
          <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${stats.recentActivity}</div>
          <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Last 30 Days</div>
        </div>
        <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
          <div class="stat-value text-sm font-bold text-gray-900 dark:text-white">${formatLastPerformed(stats.lastCompleted)}</div>
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
 */
function renderHabitCompletionCarousel(periods) {
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
 */
function initializeHabitCompletionCarousel() {
  const carousel = document.getElementById('habit-completion-carousel');
  const track = document.getElementById('habit-carousel-track');
  const dots = document.getElementById('habit-carousel-dots');

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
    dot.addEventListener('click', () => {
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

  carousel.addEventListener('mouseleave', () => {
    if (isDragging) {
      isDragging = false;
      carousel.style.cursor = 'grab';
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
}

// formatLastCompleted function moved to datetime.js as formatLastPerformed for centralization

// ---------- Home View ----------

export function renderHomeView() {
  // Update collapsed state of completed/skipped sections according to settings
  const completedSection = document.getElementById('completed-section');
  const skippedSection = document.getElementById('skipped-section');
  if (completedSection)
    completedSection.classList.toggle('collapsed', appData.settings.hideCompleted);
  if (skippedSection) skippedSection.classList.toggle('collapsed', appData.settings.hideSkipped);

  // Re-calculate progress ring using the same logic as home view
  // This ensures consistency with the selected group filtering
  const dateObj = new Date(appData.selectedDate);

  // 1) Habits that belong to the currently selected group
  // 2) Are actually scheduled for the selected date (takes holiday mode into account)
  const scheduledHabits = appData.habits.filter(
    (h) => belongsToSelectedGroup(h, appData.selectedGroup) && isHabitScheduledOnDate(h, dateObj)
  );

  // 3) Remove any that the user explicitly skipped
  const activeHabits = scheduledHabits.filter((h) => !isHabitSkippedToday(h, dateObj));

  // 4) Determine how many of the remaining active habits are completed
  const completed = activeHabits.filter((h) => isHabitCompleted(h, dateObj));

  const progress = activeHabits.length ? (completed.length / activeHabits.length) * 100 : 0;
  updateProgressRing(progress);
}

export function toggleHabitCompletion(habitId) {
  mutate((state) => {
    const habit = state.habits.find((h) => h.id === habitId);
    if (!habit) return;
    const date = new Date(state.selectedDate || Date.now());
    _toggleDone(habit, date);
  });
  renderHomeView();
}

export function toggleSectionVisibility(sectionType) {
  const section = document.getElementById(`${sectionType}-section`);
  if (!section) return;
  const collapsed = !section.classList.toggle('collapsed'); // toggle returns new state
  if (sectionType === 'completed') appData.settings.hideCompleted = collapsed;
  else if (sectionType === 'skipped') appData.settings.hideSkipped = collapsed;
  // update toggle text if button exists
  const toggleBtn = section.querySelector('.toggle-section');
  if (toggleBtn) toggleBtn.textContent = collapsed ? 'Show ⌄' : 'Hide ⌄';
}

// ---------- Habits View ----------

function createHabitItem(habit, category, isLast) {
  const borderClass = isLast ? 'rounded-b-2xl' : '';

  // ----- Build meta chips -----
  function buildChip(inner) {
    return `<span class="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-black" style="background-color:${category.color}20; color:#000">${inner}</span>`;
  }

  const chips = [];

  if (habit.paused) {
    chips.push(buildChip('Paused'));
  } else {
    // Frequency chip (without extra parts after •)
    const frequencyText = getFrequencyText(habit).split(' • ')[0];
    chips.push(buildChip(`${getFrequencyIcon(habit)} ${frequencyText}`));

    // Scheduled time chip with clock icon
    if (habit.scheduledTime) {
      const clockIcon =
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      chips.push(buildChip(`${clockIcon} ${habit.scheduledTime}`));
    }

    // Holiday chip
    if (habit.activeOnHolidays) {
      chips.push(buildChip('<span class="material-icons text-base leading-none">flight</span>'));
    }
  }

  const metaHTML = `<div class="habit-meta flex flex-wrap gap-1 text-gray-600 dark:text-gray-400 text-xs -mt-1">${chips.join('')}</div>`;

  return `
    <div class="flex flex-row items-stretch habit-row w-full mb-1">
      <div class="habit-drag-handle drag-handle hidden w-7 h-12 flex items-center justify-center cursor-grab text-gray-400 mr-1">
        <span class="material-icons text-2xl leading-none">drag_handle</span>
      </div>
      <div class="habit-item flex items-center px-4 py-1.5 bg-white dark:bg-gray-800 border-[3px] rounded-xl ${borderClass} flex-grow w-full" style="border-color: ${category.color}" data-habit-id="${habit.id}">
        <div class="habit-icon w-8 h-8 rounded-lg flex items-center justify-center mr-4 text-xl" style="background-color: ${category.color}20;">
          ${habit.icon || '📋'}
        </div>
        <div class="habit-content flex-grow">
          <div class="habit-name text-sm font-semibold text-gray-900 dark:text-white">${habit.name}</div>
          ${metaHTML}
        </div>
        <div class="habit-actions flex items-center gap-2 ml-2">
          <button class="stats-habit-btn w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors" data-habit-id="${habit.id}" title="View Stats">
            <span class="material-icons text-lg">bar_chart</span>
          </button>
          <button class="edit-habit-btn flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center" data-habit-id="${habit.id}">
            <svg class="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg>
          </button>
        </div>
      </div>
    </div>`;
}

function createCategorySection(category, habits) {
  // color classes not needed anymore because we inline background and force black text

  let habitsHTML = '';
  if (habits.length) {
    habitsHTML = habits
      .map((h, idx) => createHabitItem(h, category, idx === habits.length - 1))
      .join('');
  } else {
    habitsHTML =
      '<div class="p-6 text-center text-gray-400 dark:text-gray-500">No habits yet</div>';
  }

  const arrowBtn = `<button class="expand-btn h-5 w-5 flex items-center justify-center text-black">
      <span class="material-icons transition-transform leading-none">expand_more</span>
    </button>`;

  const editBtn = `<button class="edit-category-btn w-8 h-8 rounded-full flex items-center justify-center" data-category-id="${category.id}" style="background-color:${category.color}">
      <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2"/>
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/>
      </svg>
    </button>`;

  return `<div class="category-section mb-4" data-category-id="${category.id}">
      <div class="flex items-center gap-2">
        <div class="category-drag-handle drag-handle hidden w-7 h-12 flex items-center justify-center cursor-grab text-gray-400">
          <span class="material-icons text-2xl leading-none">drag_handle</span>
        </div>
        <div class="category-header flex items-center justify-between px-4 py-0 rounded-t-2xl cursor-pointer select-none flex-grow" style="background:${hexToRgba(category.color, 0.25)};">
          <div class="category-title flex items-center gap-3">
            <span class="font-semibold text-lg leading-none text-black py-1.5">${category.name}</span>
          </div>
          ${arrowBtn}
        </div>
        ${editBtn}
      </div>
      <div class="category-habits pl-6">${habitsHTML}</div>
    </div>`;
}

/**
 * Mounts the habits list container
 * @param {Function} onHabitClick - Callback when habit is clicked
 * @returns {HTMLElement} The habits list container element
 */
export function mountHabitsList(onHabitClick) {
  const listContainer = document.createElement('div');
  listContainer.id = 'habits-list-container';
  listContainer.className = 'habits-list flex-grow overflow-y-auto px-4 pb-8';

  // Store callback for later use
  listContainer._onHabitClick = onHabitClick;

  return listContainer;
}

/**
 * Renders the habits list content
 * @param {Function} onHabitClick - Callback when habit is clicked
 */
export function renderHabitsList(onHabitClick) {
  const listContainer = document.getElementById('habits-list-container');
  if (!listContainer) return;

  // Store callback for later use
  listContainer._onHabitClick = onHabitClick;

  // Clear existing content
  listContainer.innerHTML = '';

  // Build categories map
  const map = new Map();
  appData.categories.forEach((cat) => map.set(cat.id, []));
  appData.habits.forEach((h) => {
    if (map.has(h.categoryId)) map.get(h.categoryId).push(h);
  });

  appData.categories.forEach((cat) => {
    const sectionHTML = createCategorySection(cat, map.get(cat.id));
    listContainer.insertAdjacentHTML('beforeend', sectionHTML);
  });

  // If no categories exist, show CTA placeholder
  if (appData.categories.length === 0) {
    const placeholder = `
      <div class="w-full flex flex-col items-center justify-center py-12 mt-6 text-center space-y-2" id="no-category-cta">
        <span class="material-icons text-5xl text-gray-400">create_new_folder</span>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">No categories yet</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400 max-w-xs mx-auto">Start by creating a category to organise your habits.</p>
        <button class="create-first-category-btn bg-ios-orange text-white px-4 py-3 rounded-xl font-medium hover:bg-orange-600 transition-colors">Create Your First Category</button>
      </div>`;
    listContainer.insertAdjacentHTML('beforeend', placeholder);

    listContainer.querySelector('.create-first-category-btn')?.addEventListener('click', () => {
      import('./ui/categories.js').then((m) => {
        m.initializeCategories();
        m.openAddCategoryModal();
      });
    });
  }

  // Attach completion toggle listeners
  listContainer.querySelectorAll('.habit-item').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.habitId;
      if (id) toggleHabitCompletion(id);
    });
  });

  // Stats habit buttons
  listContainer.querySelectorAll('.stats-habit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.habitId;
      if (id) handleHabitStatsClick(id);
    });
  });

  // Edit habit buttons
  listContainer.querySelectorAll('.edit-habit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.habitId;
      if (id) import('./modals/HabitFormModal.js').then((m) => m.openEditHabitModal(id));
    });
  });

  // Expand/collapse handlers (arrow button or header click)
  function toggleCategory(section) {
    if (!section) return;
    const habitsDiv = section.querySelector('.category-habits');
    if (!habitsDiv) return;
    const collapsed = habitsDiv.classList.toggle('hidden');
    const iconEl = section.querySelector('.expand-btn .material-icons');
    if (iconEl) iconEl.classList.toggle('rotate-180', collapsed);
  }

  listContainer.querySelectorAll('.expand-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCategory(btn.closest('.category-section'));
    });
  });

  listContainer.querySelectorAll('.category-header').forEach((hdr) => {
    hdr.addEventListener('click', (e) => {
      if (e.target.closest('.expand-btn') || e.target.closest('.edit-category-btn')) return; // ignore edit/arrow clicks
      toggleCategory(hdr.closest('.category-section'));
    });
  });

  // Initialize category event handlers (for edit category buttons)
  import('./ui/categories.js').then((m) => m.initializeCategories());
}

export function initializeHabitsList() {
  renderHomeView();
  renderHabitsList();

  // Attach toggle buttons (home view)
  document.querySelectorAll('.toggle-section').forEach((btn) => {
    btn.addEventListener('click', () => {
      const section = btn.closest('.habits-section');
      if (section && section.id) {
        const type = section.id.replace('-section', '');
        toggleSectionVisibility(type);
      }
    });
  });
}
