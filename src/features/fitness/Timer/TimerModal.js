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
  _eventsBound: false,

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

  },

  /**
   * Binds all event handlers for the timer modal
   */
  bindEvents() {
    if (this._eventsBound) return;

    // Close button
    const closeBtn = document.getElementById('close-timer-modal');
    if (!closeBtn) return;
    this._eventsBound = true;
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

    // Escape, focus containment and focus restoration are owned by Modal.js.
  },
};
