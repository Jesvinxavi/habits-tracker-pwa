// LapList.js - Lap list component for managing lap times
import { getTimerState } from '../../utils/timer.js';
import { formatElapsedTime } from '../../utils/datetime.js';

/**
 * LapList component for managing lap times
 */
export const LapList = {
  // Lap times storage for current session
  _sessionLapTimes: [],

  /**
   * Clears all lap times
   */
  clearLaps() {
    this._sessionLapTimes = [];
  },

  /**
   * Records a lap time
   */
  recordLap() {
    const timerState = getTimerState();

    if (!timerState.isRunning && timerState.elapsedSeconds === 0) {
      return; // Can't record lap if timer isn't running or hasn't started
    }

    const currentTime = timerState.elapsedSeconds;
    const lastLapTotal = this._sessionLapTimes.reduce((sum, lap) => sum + lap.duration, 0);
    const currentLapTime = currentTime - lastLapTotal;

    // Record the lap
    const lapData = {
      number: this._sessionLapTimes.length + 1,
      duration: currentLapTime,
      totalTime: currentTime,
      timestamp: new Date().toISOString(),
    };

    this._sessionLapTimes.push(lapData);

    // Update display
    this.render();
  },

  /**
   * Deletes a specific lap time by index
   */
  deleteLap(lapIndex) {
    if (lapIndex < 0 || lapIndex >= this._sessionLapTimes.length) {
      return; // Invalid index
    }

    // Remove the lap
    this._sessionLapTimes.splice(lapIndex, 1);

    // Renumber remaining laps
    this._sessionLapTimes.forEach((lap, index) => {
      lap.number = index + 1;
    });

    // Update display
    this.render();
  },

  /**
   * Gets current lap time in seconds
   */
  getCurrentLapTime() {
    const timerState = getTimerState();
    const totalLapTime = this._sessionLapTimes.reduce((sum, lap) => sum + lap.duration, 0);
    return timerState.elapsedSeconds - totalLapTime;
  },

  /**
   * Gets total session time including all laps
   */
  getTotalSessionTime() {
    const timerState = getTimerState();
    return timerState.elapsedSeconds;
  },

  /**
   * Renders the lap times list
   */
  render() {
    const container = document.getElementById('lap-times-container');
    const lapList = document.getElementById('lap-times-list');
    const totalTimeEl = document.getElementById('total-session-time');

    if (!container || !lapList) return;

    // Update total time
    if (totalTimeEl) {
      const totalTime = this.getTotalSessionTime();
      totalTimeEl.textContent = formatElapsedTime(totalTime);
    }

    // Show/hide container based on whether we have laps
    if (this._sessionLapTimes.length === 0) {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');

    // Clear existing list
    lapList.innerHTML = '';

    // Organize lap times in 2-column grid like activity set pills
    const n = this._sessionLapTimes.length;
    const col1Count = Math.ceil(n / 2);

    // Build ordered index list: col1 row-wise first, then matching col2 item if exists
    const orderedIndices = [];
    for (let i = 0; i < col1Count; i++) {
      // Left column
      orderedIndices.push(i);
      // Right column (if any)
      const rightIdx = col1Count + i;
      if (rightIdx < n) orderedIndices.push(rightIdx);
    }

    // Create container with 2-column grid
    const gridContainer = document.createElement('div');
    gridContainer.className = 'lap-times-grid grid grid-cols-2 gap-2';

    // Add each lap time in the calculated order
    orderedIndices.forEach((lapIndex) => {
      const lap = this._sessionLapTimes[lapIndex];
      const lapItem = document.createElement('div');
      lapItem.className =
        'flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500';

      lapItem.innerHTML = `
        <span class="text-sm font-medium text-gray-700 dark:text-gray-200">Lap ${lap.number}</span>
        <div class="flex items-center gap-2">
          <span class="text-sm font-mono text-gray-900 dark:text-white">${formatElapsedTime(lap.duration)}</span>
          <button class="delete-lap-btn text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded transition-colors" data-lap-index="${lapIndex}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      `;

      gridContainer.appendChild(lapItem);
    });

    lapList.appendChild(gridContainer);

    // Add scroll indicators if content overflows
    setTimeout(() => {
      const isOverflowing = lapList.scrollHeight > lapList.clientHeight;
      if (isOverflowing) {
        // Add subtle fade at bottom to indicate more content
        if (!lapList.querySelector('.scroll-fade')) {
          const fadeIndicator = document.createElement('div');
          fadeIndicator.className =
            'scroll-fade absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-gray-50 dark:from-gray-700 to-transparent pointer-events-none';
          lapList.appendChild(fadeIndicator);
        }
      } else {
        // Remove fade if no overflow
        const existingFade = lapList.querySelector('.scroll-fade');
        if (existingFade) {
          existingFade.remove();
        }
      }
    }, 0);
  },

  /**
   * Binds event handlers for lap list functionality
   */
  bindEvents() {
    // Record lap button
    const recordLapBtn = document.getElementById('record-lap-btn');
    if (recordLapBtn) {
      recordLapBtn.addEventListener('click', () => this.recordLap());
    }

    // Delegate delete button events to container
    const lapList = document.getElementById('lap-times-list');
    if (lapList) {
      lapList.addEventListener('click', (e) => {
        if (e.target.closest('.delete-lap-btn')) {
          e.stopPropagation();
          const button = e.target.closest('.delete-lap-btn');
          const lapIndex = parseInt(button.dataset.lapIndex);
          this.deleteLap(lapIndex);
        }
      });
    }
  },
};
