// ProgramBuilderModal.js - Define a training block and its weekly routine schedule
import { closeModal, openModal, topModalId } from '../../../components/Modal.js';
import { showConfirm } from '../../../components/ConfirmDialog.js';
import { getRoutines } from '../routines.js';
import {
  addProgram,
  updateProgram,
  deleteProgram,
  setActiveProgram,
  getProgram,
  getProgramScheduledDays,
} from '../programs.js';

const MODAL_ID = 'program-builder-modal';
const DEFAULT_LENGTH_DAYS = 55; // today + 55 days is an eight-week block
const MS_PER_DAY = 86400000;

// Monday-first, matching how the weekly schedule reads to a user.
const WEEKDAYS = [
  { dayOfWeek: 1, label: 'Mon' },
  { dayOfWeek: 2, label: 'Tue' },
  { dayOfWeek: 3, label: 'Wed' },
  { dayOfWeek: 4, label: 'Thu' },
  { dayOfWeek: 5, label: 'Fri' },
  { dayOfWeek: 6, label: 'Sat' },
  { dayOfWeek: 0, label: 'Sun' },
];

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
 * ProgramBuilderModal - creates and edits training programs.
 */
export const ProgramBuilderModal = {
  _editProgramId: null,
  _onSaved: null,

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

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    this._setTitle('New Program');
    this._setName('');
    this._setDates(todayKey, addDays(todayKey, DEFAULT_LENGTH_DAYS));
    this._renderSchedule([]);
    this._setDeleteVisible(false);
    this._validate();
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

    this._setTitle('Edit Program');
    this._setName(program.name || '');
    this._setDates(program.startDate, program.endDate);
    // Filtered read: schedule rows never show a routine that no longer exists.
    this._renderSchedule(getProgramScheduledDays(programId));
    this._setDeleteVisible(true);
    this._validate();
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
   * Renders the seven weekday rows, each a routine select with a Rest option.
   * @param {Array<{dayOfWeek: number, routineId: string}>} scheduledDays - Existing schedule
   * @returns {void}
   */
  _renderSchedule(scheduledDays = []) {
    const host = document.getElementById('program-schedule-rows');
    if (!host) return;

    const routines = getRoutines();
    const notice = document.getElementById('program-no-routines-notice');
    // Opening into a dead end without explanation would be unkind; say why Save is off.
    notice?.classList.toggle('hidden', routines.length > 0);
    host.classList.toggle('hidden', routines.length === 0);

    if (routines.length === 0) {
      host.innerHTML = '';
      return;
    }

    const selectedFor = new Map(
      scheduledDays.map((day) => [Number(day.dayOfWeek), day.routineId])
    );

    host.innerHTML = WEEKDAYS.map(({ dayOfWeek, label }) => {
      const selected = selectedFor.get(dayOfWeek) || '';
      const options = [
        `<option value=""${selected ? '' : ' selected'}>Rest</option>`,
        ...routines.map(
          (routine) =>
            `<option value="${routine.id}"${routine.id === selected ? ' selected' : ''}>${routine.name}</option>`
        ),
      ].join('');
      return `
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300 w-10">${label}</span>
          <div class="relative flex-1">
            <select class="program-day-select w-full px-4 py-2 bg-white/80 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-ios-blue/50 focus:border-ios-blue transition-all duration-200 appearance-none h-10" data-day-of-week="${dayOfWeek}">
              ${options}
            </select>
          </div>
        </div>
      `;
    }).join('');

    host.querySelectorAll('.program-day-select').forEach((select) => {
      select.addEventListener('change', () => this._validate());
    });
  },

  /**
   * Reads the schedule out of the selects.
   * @returns {Array<{dayOfWeek: number, routineId: string}>} Non-empty schedule entries.
   */
  _collectSchedule() {
    return [...document.querySelectorAll('#program-schedule-rows .program-day-select')]
      .filter((select) => select.value)
      .map((select) => ({
        dayOfWeek: Number(select.dataset.dayOfWeek),
        routineId: select.value,
      }));
  },

  /**
   * Enables Save only for a named program with a valid range and a scheduled day.
   * @returns {void}
   */
  _validate() {
    const saveBtn = document.getElementById('save-program-builder');
    const errorEl = document.getElementById('program-date-error');
    if (!saveBtn) return;

    const { start, end } = this._dates();
    const inverted = Boolean(start && end && start > end);
    errorEl?.classList.toggle('hidden', !inverted);

    const valid =
      this._name().length > 0 &&
      Boolean(start) &&
      Boolean(end) &&
      !inverted &&
      this._collectSchedule().length > 0;

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
    if (!name || !start || !end || start > end || scheduledDays.length === 0) return;

    let programId = this._editProgramId;

    if (programId) {
      const saved = await updateProgram(programId, {
        name,
        startDate: start,
        endDate: end,
        scheduledDays,
      });
      if (!saved) return;
    } else {
      // A newly created program becomes the active one — the user just chose to plan it.
      const created = await addProgram({ name, startDate: start, endDate: end, scheduledDays });
      if (!created) return;
      programId = created.id;
    }

    // Activating deactivates any other active program (Phase 1, Task 1.7).
    const activated = await setActiveProgram(programId);
    if (!activated) return;

    closeModal(MODAL_ID);
    this._onSaved?.();
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

    document.getElementById('save-program-builder')?.addEventListener('click', () => {
      void this._handleSave();
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
