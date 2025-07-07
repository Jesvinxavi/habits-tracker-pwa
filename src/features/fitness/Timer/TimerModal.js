// TimerModal.js - Timer modal component with display and controls
import { getTimerState } from '../timer.js';
import { formatElapsedTime } from '../../../shared/datetime.js';
import { openModal, closeModal } from '../../../components/Modal.js';
import { TimerControls } from './TimerControls.js';
import { LapList } from './LapList.js';

/**
 * TimerModal component for comprehensive timer functionality
 */
export const TimerModal = {
  // Timer modal update interval
  _updateInterval: null,

  /**
   * Opens the timer modal
   */
  open() {
    // Clear any existing lap times when opening modal (fresh session)
    if (getTimerState().elapsedSeconds === 0) {
      LapList.clearLaps();
    }

    // Update display before showing
    this.updateDisplay();

    // Show modal using existing modal system
    openModal('timer-modal');

    // Set up update interval for display (every second)
    this._startUpdateInterval();
  },

  /**
   * Closes the timer modal
   */
  close() {
    // Stop update interval
    this._stopUpdateInterval();

    // Remove escape key listener if it exists
    const modal = document.getElementById('timer-modal');
    if (modal && modal._escapeHandler) {
      document.removeEventListener('keydown', modal._escapeHandler);
      modal._escapeHandler = null;
    }

    // Update timer button state when closing modal
    this._updateTimerButton();

    // Close modal
    closeModal('timer-modal');
  },

  /**
   * Starts the update interval for the timer display
   */
  _startUpdateInterval() {
    // Clear any existing interval
    this._stopUpdateInterval();

    // Update immediately
    this.updateDisplay();

    // Set up interval to update every second
    this._updateInterval = setInterval(() => {
      this.updateDisplay();
    }, 1000);
  },

  /**
   * Stops the update interval
   */
  _stopUpdateInterval() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }
  },

  /**
   * Updates timer display and statistics in the modal
   */
  updateDisplay() {
    const timerState = getTimerState();
    const timeDisplay = document.getElementById('timer-time-display');
    const statusDisplay = document.getElementById('timer-status');

    // Update time display - show current lap time
    if (timeDisplay) {
      const currentLapTime = LapList.getCurrentLapTime();
      timeDisplay.textContent = formatElapsedTime(currentLapTime);
    }

    // Update status
    if (statusDisplay) {
      if (timerState.isRunning) {
        statusDisplay.textContent = 'Running...';
      } else if (timerState.elapsedSeconds > 0) {
        statusDisplay.textContent = 'Paused';
      } else {
        statusDisplay.textContent = 'Ready to start';
      }
    }

    // Update controls
    TimerControls.update();

    // Update lap times list
    LapList.render();

    // Update timer button state
    this._updateTimerButton();
  },

  /**
   * Updates the timer button state based on current timer state
   */
  _updateTimerButton() {
    const timerBtn = document.getElementById('start-timer-btn');
    if (!timerBtn) return;

    const timerState = getTimerState();

    // Update visual state based on timer status
    if (timerState.isRunning) {
      // Change to orange/red visual state when timer is running
      timerBtn.classList.remove(
        'bg-blue-100',
        'dark:bg-blue-900',
        'text-blue-600',
        'dark:text-blue-300'
      );
      timerBtn.classList.add(
        'bg-orange-100',
        'dark:bg-orange-900',
        'text-orange-600',
        'dark:text-orange-300'
      );
    } else {
      // Restore original blue styling when timer is stopped
      timerBtn.classList.remove(
        'bg-orange-100',
        'dark:bg-orange-900',
        'text-orange-600',
        'dark:text-orange-300'
      );
      timerBtn.classList.add(
        'bg-blue-100',
        'dark:bg-blue-900',
        'text-blue-600',
        'dark:text-blue-300'
      );
    }
  },

  /**
   * Binds all event handlers for the timer modal
   */
  bindEvents() {
    // Close button
    const closeBtn = document.getElementById('close-timer-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Bind controls events
    TimerControls.bindEvents(() => {
      this.updateDisplay();
    });

    // Bind lap list events
    LapList.bindEvents();

    // Modal backdrop click to close
    const modal = document.getElementById('timer-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        // Only close if clicking the overlay, not the modal content
        if (e.target === modal) {
          this.close();
        }
      });
    }

    // Escape key to close modal
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape') {
        const timerModal = document.getElementById('timer-modal');
        if (timerModal && !timerModal.classList.contains('hidden')) {
          this.close();
        }
      }
    };

    // Add escape key listener (will be removed when modal closes)
    document.addEventListener('keydown', handleEscapeKey);

    // Store reference to remove listener later
    if (modal) {
      modal._escapeHandler = handleEscapeKey;
    }
  },
};
