// ProgramBuilderModal.js - Define a training block, its rest days and its schedule
import { closeModal, openModal, topModalId } from '../../../components/Modal.js';
import { showConfirm } from '../../../components/ConfirmDialog.js';
import { getState } from '../../../core/state.js';
import { getLocalISODate } from '../../../shared/datetime.js';
import { getRoutines, getRoutine, recordRoutinesForDate } from '../routines.js';
import {
  addProgram,
  updateProgram,
  deleteProgram,
  setActiveProgram,
  getProgram,
  getProgramScheduledDays,
  getProgramAnytimeRoutines,
  PRESCRIPTIVE,
  FREEFORM,
} from '../programs.js';
import { RoutinePickerModal } from './RoutinePickerModal.js';

const MODAL_ID = 'program-builder-modal';
const DEFAULT_LENGTH_DAYS = 55; // today + 55 days is an eight-week block
const MS_PER_DAY = 86400000;

// Sunday-first indices with the habits page's single-letter labels, so the rest
// selector reads exactly like the habit frequency day picker.
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
// Monday-first display order for the schedule rows.
const ROW_ORDER = [1, 2, 3, 4, 5, 6, 0];
const ROW_LABELS = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };

const MODE_HINTS = {
  [PRESCRIPTIVE]: 'Pick which routines you do on each day of the week.',
  [FREEFORM]:
    'Pin routines to days if you like, and set weekly targets that can be done any day.',
};

/**
 * Shifts a date key by a number of days without leaving the UTC anchor.
 * @param {string} iso Date key, YYYY-MM-DD.
 * @param {number} days Days to add.
 * @returns {string} The shifted date key.
 */
function addDays(iso, days) {
  const time = Date.parse(`${iso}T00:00:00.000Z`);
  return new Date(time + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * ProgramBuilderModal - creates and edits training programs in either mode.
 */
export const ProgramBuilderModal = {
  _editProgramId: null,
  _onSaved: null,
  _mode: PRESCRIPTIVE,
  _restDays: new Set(),
  // Map of weekday index -> ordered routine ids pinned to that day.
  _dayRoutines: new Map(),
  // Ordered list of { routineId, count } for the anytime bucket.
  _anytime: [],

  /**
   * Opens the builder for a new program, defaulting to an eight-week block from today.
   * @param {Object} [options] - Open options
   * @param {Function} [options.onSaved] - Called after a successful save or delete
   * @returns {void}
   */
  openCreateMode({ onSaved = null } = {}) {
    this._bindStaticHandlers();
    this._editProgramId = null;
    this._onSaved = onSaved;
    this._mode = PRESCRIPTIVE;
    this._restDays = new Set();
    this._dayRoutines = new Map();
    this._anytime = [];

    const todayKey = getLocalISODate(new Date());
    this._setTitle('New Program');
    this._setName('');
    this._setDates(todayKey, addDays(todayKey, DEFAULT_LENGTH_DAYS));
    this._setDeleteVisible(false);
    this._setAddTodayVisible(false);
    this._renderAll();
    openModal(MODAL_ID);
  },

  /**
   * Opens the builder on an existing program.
   * @param {string} programId - Program client id
   * @param {Object} [options] - Open options
   * @param {Function} [options.onSaved] - Called after a successful save or delete
   * @returns {void}
   */
  openEditMode(programId, { onSaved = null } = {}) {
    const program = getProgram(programId);
    if (!program) return;

    this._bindStaticHandlers();
    this._editProgramId = programId;
    this._onSaved = onSaved;
    this._mode = program.scheduleMode === FREEFORM ? FREEFORM : PRESCRIPTIVE;
    this._restDays = new Set((program.restDays || []).map(Number));

    // Filtered reads: rows never show a routine that no longer exists.
    this._dayRoutines = new Map();
    getProgramScheduledDays(programId).forEach((day) => {
      const key = Number(day.dayOfWeek);
      if (!this._dayRoutines.has(key)) this._dayRoutines.set(key, []);
      this._dayRoutines.get(key).push(day.routineId);
    });
    this._anytime = getProgramAnytimeRoutines(programId).map((entry) => ({ ...entry }));

    this._setTitle('Edit Program');
    this._setName(program.name || '');
    this._setDates(program.startDate, program.endDate);
    this._setDeleteVisible(true);
    this._setAddTodayVisible(true);
    this._renderAll();
    openModal(MODAL_ID);
  },

  /**
   * Closes the builder.
   * @returns {void}
   */
  close() {
    closeModal(MODAL_ID);
  },

  /**
   * Re-renders every dynamic section and revalidates.
   * @returns {void}
   */
  _renderAll() {
    this._renderMode();
    this._renderRestDays();
    this._renderSchedule();
    this._renderAnytime();
    this._validate();
  },

  /**
   * @param {string} text - Heading text
   * @returns {void}
   */
  _setTitle(text) {
    const title = document.getElementById('program-builder-title');
    if (title) title.textContent = text;
  },

  /**
   * @param {string} value - Program name
   * @returns {void}
   */
  _setName(value) {
    const input = document.getElementById('program-name-input');
    if (input) input.value = value;
  },

  /**
   * @returns {string} The trimmed program name.
   */
  _name() {
    return (document.getElementById('program-name-input')?.value || '').trim();
  },

  /**
   * @param {string} startISO - Start date key
   * @param {string} endISO - End date key
   * @returns {void}
   */
  _setDates(startISO, endISO) {
    const start = document.getElementById('program-start-input');
    const end = document.getElementById('program-end-input');
    if (start) start.value = startISO || '';
    if (end) end.value = endISO || '';
  },

  /**
   * @returns {{start: string, end: string}} The current date values.
   */
  _dates() {
    return {
      start: document.getElementById('program-start-input')?.value || '',
      end: document.getElementById('program-end-input')?.value || '',
    };
  },

  /**
   * @param {boolean} visible - Whether the delete button shows
   * @returns {void}
   */
  _setDeleteVisible(visible) {
    document.getElementById('delete-program-btn')?.classList.toggle('hidden', !visible);
  },

  /**
   * @param {boolean} visible - Whether the add-to-current-day button shows
   * @returns {void}
   */
  _setAddTodayVisible(visible) {
    document.getElementById('program-add-today-btn')?.classList.toggle('hidden', !visible);
  },

  /**
   * Reflects the selected mode on the segmented control.
   * @returns {void}
   */
  _renderMode() {
    document.querySelectorAll('.program-mode-btn').forEach((btn) => {
      const active = btn.dataset.mode === this._mode;
      btn.classList.toggle('bg-white', active);
      btn.classList.toggle('dark:bg-gray-700', active);
      btn.classList.toggle('text-gray-900', active);
      btn.classList.toggle('dark:text-white', active);
      btn.classList.toggle('border', active);
      btn.classList.toggle('border-gray-200', active);
      btn.classList.toggle('dark:border-gray-600', active);
      btn.classList.toggle('shadow-sm', active);
      btn.classList.toggle('text-gray-600', !active);
      btn.classList.toggle('dark:text-gray-400', !active);
      btn.setAttribute('aria-pressed', String(active));
    });

    const hint = document.getElementById('program-mode-hint');
    if (hint) hint.textContent = MODE_HINTS[this._mode];

    const heading = document.getElementById('program-schedule-heading');
    if (heading) {
      heading.textContent = this._mode === FREEFORM ? 'Pinned to days' : 'Weekly schedule';
    }

    document
      .getElementById('program-anytime-section')
      ?.classList.toggle('hidden', this._mode !== FREEFORM);
  },

  /**
   * Builds the seven rest-day buttons, matching the habits day picker.
   * @returns {void}
   */
  _renderRestDays() {
    const grid = document.getElementById('program-rest-day-grid');
    if (!grid) return;

    if (grid.childElementCount === 0) {
      grid.innerHTML = DAY_LABELS.map(
        (label, index) => `
        <button type="button" class="day-button program-rest-day flex-1 h-12 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium text-sm hover:border-ios-blue transition-colors" data-day="${index}" aria-label="${ROW_LABELS[index]} rest day" aria-pressed="false">${label}</button>
      `
      ).join('');
      grid.querySelectorAll('.program-rest-day').forEach((btn) => {
        btn.addEventListener('click', () => this._toggleRestDay(Number(btn.dataset.day)));
      });
    }

    grid.querySelectorAll('.program-rest-day').forEach((btn) => {
      const isRest = this._restDays.has(Number(btn.dataset.day));
      btn.classList.toggle('selected', isRest);
      btn.setAttribute('aria-pressed', String(isRest));
    });
  },

  /**
   * Marks a weekday as rest, or clears it. Routines pinned to a day that becomes
   * rest are dropped, since a rest day cannot hold a session.
   * @param {number} dayOfWeek - 0 = Sunday
   * @returns {void}
   */
  _toggleRestDay(dayOfWeek) {
    if (this._restDays.has(dayOfWeek)) {
      this._restDays.delete(dayOfWeek);
    } else {
      this._restDays.add(dayOfWeek);
      this._dayRoutines.delete(dayOfWeek);
    }
    this._renderRestDays();
    this._renderSchedule();
    this._validate();
  },

  /**
   * Renders one row per non-rest weekday, each listing the routines pinned to it.
   * @returns {void}
   */
  _renderSchedule() {
    const host = document.getElementById('program-schedule-rows');
    if (!host) return;

    const routines = getRoutines();
    const noRoutines = routines.length === 0;
    const activeDays = ROW_ORDER.filter((day) => !this._restDays.has(day));

    document.getElementById('program-no-routines-notice')?.classList.toggle('hidden', !noRoutines);
    document
      .getElementById('program-all-rest-notice')
      ?.classList.toggle('hidden', noRoutines || activeDays.length > 0);

    if (noRoutines || activeDays.length === 0) {
      host.innerHTML = '';
      return;
    }

    host.innerHTML = activeDays
      .map((day) => {
        const ids = this._dayRoutines.get(day) || [];
        const names = ids
          .map((id) => getRoutine(id)?.name)
          .filter(Boolean)
          .join(', ');
        const empty = names.length === 0;
        return `
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300 w-10 flex-shrink-0">${ROW_LABELS[day]}</span>
          <button type="button" class="program-day-select flex-1 min-w-0 flex items-center justify-between gap-2 px-4 py-2 bg-white/80 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-ios-blue/50 transition-all duration-200 h-10" data-day-of-week="${day}">
            <span class="truncate text-sm ${empty ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white font-medium'}">${empty ? 'Rest' : names}</span>
            <span class="material-icons text-lg text-gray-400 flex-shrink-0">chevron_right</span>
          </button>
        </div>
      `;
      })
      .join('');

    host.querySelectorAll('.program-day-select').forEach((btn) => {
      btn.addEventListener('click', () => this._openDayPicker(Number(btn.dataset.dayOfWeek)));
    });
  },

  /**
   * Opens the routine picker for one weekday, seeded with that day's routines.
   * @param {number} dayOfWeek - 0 = Sunday
   * @returns {void}
   */
  _openDayPicker(dayOfWeek) {
    RoutinePickerModal.open({
      selectedIds: [...(this._dayRoutines.get(dayOfWeek) || [])],
      title: `${ROW_LABELS[dayOfWeek]} routines`,
      confirmLabel: 'Done',
      allowEmpty: true,
      onConfirm: (routineIds) => {
        if (routineIds.length === 0) this._dayRoutines.delete(dayOfWeek);
        else this._dayRoutines.set(dayOfWeek, routineIds);
        this._renderSchedule();
        this._validate();
      },
    });
  },

  /**
   * Renders the anytime bucket: one row per routine with a weekly count stepper.
   * @returns {void}
   */
  _renderAnytime() {
    const host = document.getElementById('program-anytime-rows');
    if (!host) return;

    const total = this._anytime.reduce((sum, entry) => sum + entry.count, 0);
    const counter = document.getElementById('program-anytime-count');
    if (counter) counter.textContent = `${total} per week`;

    if (this._anytime.length === 0) {
      host.innerHTML = `
        <p class="text-xs text-gray-500 dark:text-gray-400 py-2">Nothing added yet.</p>
      `;
      return;
    }

    host.innerHTML = this._anytime
      .map((entry) => {
        const routine = getRoutine(entry.routineId);
        if (!routine) return '';
        return `
        <div class="program-anytime-row flex items-center gap-2 px-3 py-2 bg-white/80 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl" data-routine-id="${entry.routineId}">
          <span class="material-icons text-ios-blue text-lg flex-shrink-0">repeat</span>
          <span class="flex-grow min-w-0 truncate text-sm font-medium text-gray-900 dark:text-white">${routine.name}</span>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button type="button" class="anytime-step w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors" data-routine-id="${entry.routineId}" data-delta="-1" aria-label="Decrease ${routine.name} weekly count">
              <span class="material-icons text-base">remove</span>
            </button>
            <span class="anytime-count text-sm font-bold text-gray-900 dark:text-white w-6 text-center">${entry.count}</span>
            <button type="button" class="anytime-step w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors" data-routine-id="${entry.routineId}" data-delta="1" aria-label="Increase ${routine.name} weekly count">
              <span class="material-icons text-base">add</span>
            </button>
          </div>
          <button type="button" class="anytime-remove w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors flex-shrink-0 ml-1" data-routine-id="${entry.routineId}" aria-label="Remove ${routine.name}">
            <span class="material-icons text-base">close</span>
          </button>
        </div>
      `;
      })
      .join('');

    host.querySelectorAll('.anytime-step').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._stepAnytime(btn.dataset.routineId, Number(btn.dataset.delta));
      });
    });
    host.querySelectorAll('.anytime-remove').forEach((btn) => {
      btn.addEventListener('click', () => this._removeAnytime(btn.dataset.routineId));
    });
  },

  /**
   * Adjusts a routine's weekly count, removing the row when it drops below one.
   * @param {string} routineId - Routine client id
   * @param {number} delta - +1 or -1
   * @returns {void}
   */
  _stepAnytime(routineId, delta) {
    const entry = this._anytime.find((item) => item.routineId === routineId);
    if (!entry) return;
    const next = entry.count + delta;
    if (next < 1) {
      this._removeAnytime(routineId);
      return;
    }
    entry.count = next;
    this._renderAnytime();
    this._validate();
  },

  /**
   * Drops a routine from the anytime bucket.
   * @param {string} routineId - Routine client id
   * @returns {void}
   */
  _removeAnytime(routineId) {
    this._anytime = this._anytime.filter((entry) => entry.routineId !== routineId);
    this._renderAnytime();
    this._validate();
  },

  /**
   * Opens the routine picker to choose the anytime routines.
   * @returns {void}
   */
  _openAnytimePicker() {
    RoutinePickerModal.open({
      selectedIds: this._anytime.map((entry) => entry.routineId),
      title: 'Anytime routines',
      confirmLabel: 'Done',
      allowEmpty: true,
      onConfirm: (routineIds) => {
        // Keep existing counts; new picks start at one a week.
        const existing = new Map(this._anytime.map((entry) => [entry.routineId, entry.count]));
        this._anytime = routineIds.map((routineId) => ({
          routineId,
          count: existing.get(routineId) || 1,
        }));
        this._renderAnytime();
        this._validate();
      },
    });
  },

  /**
   * Flattens the pinned day map into the stored schedule shape.
   * @returns {Array<{dayOfWeek: number, routineId: string}>} Schedule entries.
   */
  _collectSchedule() {
    const entries = [];
    ROW_ORDER.forEach((day) => {
      if (this._restDays.has(day)) return;
      (this._dayRoutines.get(day) || []).forEach((routineId) => {
        entries.push({ dayOfWeek: day, routineId });
      });
    });
    return entries;
  },

  /**
   * Enables Save for a named program with a valid range and something scheduled.
   * @returns {void}
   */
  _validate() {
    const saveBtn = document.getElementById('save-program-builder');
    const errorEl = document.getElementById('program-date-error');
    if (!saveBtn) return;

    const { start, end } = this._dates();
    const inverted = Boolean(start && end && start > end);
    errorEl?.classList.toggle('hidden', !inverted);

    // Flexible programs may rely purely on weekly targets, so either the pinned
    // schedule or the anytime bucket is enough.
    const hasSchedule =
      this._collectSchedule().length > 0 ||
      (this._mode === FREEFORM && this._anytime.length > 0);

    const valid =
      this._name().length > 0 && Boolean(start) && Boolean(end) && !inverted && hasSchedule;

    saveBtn.disabled = !valid;
    saveBtn.classList.toggle('opacity-50', !valid);
  },

  /**
   * Persists the program and makes it the active one.
   * @returns {Promise<void>}
   */
  async _handleSave() {
    const name = this._name();
    const { start, end } = this._dates();
    const scheduledDays = this._collectSchedule();
    const anytimeRoutines = this._mode === FREEFORM ? this._anytime.map((e) => ({ ...e })) : [];
    if (!name || !start || !end || start > end) return;
    if (scheduledDays.length === 0 && anytimeRoutines.length === 0) return;

    const payload = {
      name,
      startDate: start,
      endDate: end,
      scheduleMode: this._mode,
      restDays: [...this._restDays],
      scheduledDays,
      anytimeRoutines,
    };

    let programId = this._editProgramId;
    if (programId) {
      const saved = await updateProgram(programId, payload);
      if (!saved) return;
    } else {
      // A newly created program becomes the active one — the user just chose to plan it.
      const created = await addProgram(payload);
      if (!created) return;
      programId = created.id;
    }

    // Activating deactivates any other active program.
    const activated = await setActiveProgram(programId);
    if (!activated) return;

    closeModal(MODAL_ID);
    this._onSaved?.();
  },

  /**
   * Records the selected day's scheduled routines straight away, for people who
   * would rather pull the program into a day than have it appear on its own.
   * @returns {Promise<void>}
   */
  async _handleAddToCurrentDay() {
    const iso = getLocalISODate(getState().fitnessSelectedDate || new Date().toISOString());
    const weekday = new Date(`${iso}T00:00:00.000Z`).getUTCDay();

    if (this._restDays.has(weekday)) {
      showConfirm({
        title: 'Rest Day',
        message: 'This weekday is a rest day in the program.',
        okText: 'OK',
        cancelText: '',
        onOK: () => {},
      });
      return;
    }

    const routineIds = [...(this._dayRoutines.get(weekday) || [])];
    if (routineIds.length === 0) {
      showConfirm({
        title: 'Nothing Scheduled',
        message: 'No routines are scheduled for this day of the week.',
        okText: 'OK',
        cancelText: '',
        onOK: () => {},
      });
      return;
    }

    const result = await recordRoutinesForDate(routineIds, iso);
    if (result.recorded > 0) closeModal(MODAL_ID);
  },

  /**
   * Confirms and deletes the program being edited.
   * @returns {void}
   */
  _handleDelete() {
    if (!this._editProgramId) return;
    const programId = this._editProgramId;
    showConfirm({
      title: 'Delete Program?',
      message: 'This program will be permanently removed. This action cannot be undone.',
      okText: 'Delete',
      cancelText: 'Cancel',
      onOK: async () => {
        const deleted = await deleteProgram(programId);
        if (!deleted) return;
        closeModal(MODAL_ID);
        this._onSaved?.();
      },
    });
  },

  /**
   * Binds handlers to markup that lives for the page's lifetime.
   * @returns {void}
   */
  _bindStaticHandlers() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal || modal.dataset.listenerAttached) return;

    ['program-name-input', 'program-start-input', 'program-end-input'].forEach((id) => {
      const el = document.getElementById(id);
      el?.addEventListener('input', () => this._validate());
      el?.addEventListener('change', () => this._validate());
    });

    document.querySelectorAll('.program-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode === FREEFORM ? FREEFORM : PRESCRIPTIVE;
        if (mode === this._mode) return;
        this._mode = mode;
        this._renderAll();
      });
    });

    document.getElementById('program-add-anytime-btn')?.addEventListener('click', () => {
      this._openAnytimePicker();
    });

    document.getElementById('save-program-builder')?.addEventListener('click', () => {
      void this._handleSave();
    });

    document.getElementById('program-add-today-btn')?.addEventListener('click', () => {
      void this._handleAddToCurrentDay();
    });

    document.getElementById('cancel-program-builder')?.addEventListener('click', () => {
      this.close();
    });

    document.getElementById('delete-program-btn')?.addEventListener('click', () => {
      this._handleDelete();
    });

    modal.addEventListener('click', (event) => {
      if (event.target === modal) this.close();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (topModalId() !== MODAL_ID) return;
      event.preventDefault();
      this.close();
    });

    modal.dataset.listenerAttached = 'true';
  },
};
