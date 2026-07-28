// ProgramBuilderModal.js - Define a training block, its rest days and its schedule
import { closeModal, openModal, topModalId } from '../../../components/Modal.js';
import { showConfirm, showChoice } from '../../../components/ConfirmDialog.js';
import { getLocalISODate } from '../../../shared/datetime.js';
import { hexToRgba } from '../../../shared/color.js';
import {
  addProgram,
  updateProgramPlan,
  deleteProgram,
  setActiveProgram,
  getProgram,
  getProgramScheduledDays,
  findOverlappingPrograms,
} from '../programs.js';
import { programItemPresentation } from '../helpers/programItems.js';
import { RoutinePickerModal } from './RoutinePickerModal.js';
import { ActivityPickerModal } from './ActivityPickerModal.js';

const MODAL_ID = 'program-builder-modal';
const DEFAULT_LENGTH_DAYS = 55; // today + 55 days is an eight-week block
const MS_PER_DAY = 86400000;

// Single-letter labels by weekday index, as on the habits frequency picker.
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
// Monday-first display order, used by both the rest selector and the schedule
// rows: a training week runs Monday to Sunday, and the progress view splits the
// block on the same boundary.
const ROW_ORDER = [1, 2, 3, 4, 5, 6, 0];
const ROW_LABELS = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
// Picker headings spell the day out in full: "Monday Routines" reads as a title,
// "Mon routines" reads as a truncated field label.
const FULL_DAY_NAMES = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
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

// The day add menu is a single element reused across rows: only one can be open,
// and rebuilding it per row would leave listeners behind on every re-render.
let dayAddMenuEl = null;
let dayAddMenuAnchor = null;
let dayAddMenuDismissHandler = null;

/**
 * Closes the day add menu, if one is open.
 * @returns {void}
 */
function closeDayAddMenu() {
  if (dayAddMenuDismissHandler) {
    document.removeEventListener('click', dayAddMenuDismissHandler, true);
    document.removeEventListener('keydown', dayAddMenuDismissHandler, true);
    dayAddMenuDismissHandler = null;
  }
  dayAddMenuAnchor?.setAttribute('aria-expanded', 'false');
  dayAddMenuAnchor = null;
  dayAddMenuEl?.remove();
  dayAddMenuEl = null;
}

/**
 * Opens the "add activity / add routine" choice anchored to a day's + button.
 * @param {HTMLElement} button The + button the menu hangs from.
 * @param {{onAddActivity: Function, onAddRoutine: Function}} actions Choice handlers.
 * @returns {void}
 */
function openDayAddMenu(button, actions) {
  const reopeningSameButton = dayAddMenuAnchor === button;
  closeDayAddMenu();
  if (reopeningSameButton) return;

  dayAddMenuAnchor = button;
  button.setAttribute('aria-expanded', 'true');

  dayAddMenuEl = document.createElement('div');
  dayAddMenuEl.className =
    'absolute top-full left-0 mt-1 bg-gray-100 dark:bg-gray-900 rounded-[14px] shadow-lg min-w-max z-50 overflow-hidden p-1';
  dayAddMenuEl.setAttribute('role', 'menu');
  dayAddMenuEl.innerHTML = `
    <button type="button" class="day-add-option flex items-center h-9 gap-2 px-3 w-full rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-sm font-medium text-gray-900 dark:text-white" data-choice="activity" role="menuitem">
      <span class="material-icons text-[18px]">fitness_center</span><span>Add activity</span>
    </button>
    <button type="button" class="day-add-option flex items-center h-9 gap-2 px-3 w-full rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-sm font-medium text-gray-900 dark:text-white" data-choice="routine" role="menuitem">
      <span class="material-icons text-[18px]">repeat</span><span>Add routine</span>
    </button>
  `;

  dayAddMenuEl.addEventListener('click', (event) => {
    const option = event.target.closest('.day-add-option');
    if (!option) return;
    event.stopPropagation();
    const { choice } = option.dataset;
    closeDayAddMenu();
    if (choice === 'activity') actions.onAddActivity();
    else actions.onAddRoutine();
  });

  button.parentElement?.appendChild(dayAddMenuEl);

  // Left-anchored by default, but a + near the right edge would push the menu
  // past the modal. Measure once it is in the DOM and flip it to right-anchored
  // rather than guessing from the weekday index.
  const bounds = button.closest('.modal-content') || document.documentElement;
  const boundsRect = bounds.getBoundingClientRect();
  if (dayAddMenuEl.getBoundingClientRect().right > boundsRect.right - 12) {
    dayAddMenuEl.classList.remove('left-0');
    dayAddMenuEl.classList.add('right-0');
  }

  dayAddMenuEl.querySelector('.day-add-option')?.focus();

  // Capture phase, so a tap anywhere else dismisses before that target acts.
  dayAddMenuDismissHandler = (event) => {
    if (event.type === 'keydown') {
      if (event.key !== 'Escape') return;
      closeDayAddMenu();
      button.focus();
      return;
    }
    if (dayAddMenuEl?.contains(event.target) || button.contains(event.target)) return;
    closeDayAddMenu();
  };
  document.addEventListener('click', dayAddMenuDismissHandler, true);
  document.addEventListener('keydown', dayAddMenuDismissHandler, true);
}

/**
 * ProgramBuilderModal - creates and edits training programs.
 *
 * There is one scheduling model: everything the week holds is pinned to a day.
 * The day says where a session belongs, not when it is allowed to count —
 * progress credits a session anywhere in its week — so a weekly target with no
 * natural home is expressed by pinning it to whichever days suit. Programs saved
 * under the older schemes still load; their anytime entries simply stop being
 * read, and the next save drops them.
 */
export const ProgramBuilderModal = {
  _editProgramId: null,
  _onSaved: null,
  _restDays: new Set(),
  // Map of weekday index -> ordered { type, id } items pinned to that day, where
  // type is 'routine' or 'activity'.
  _dayItems: new Map(),
  // Notes are owned by the program details modal; the builder carries the
  // existing value through so a save never wipes it.
  _notes: '',

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
    this._restDays = new Set();
    this._dayItems = new Map();
    this._notes = '';

    const todayKey = getLocalISODate(new Date());
    this._setTitle('New Program');
    this._setName('');
    this._setDates(todayKey, addDays(todayKey, DEFAULT_LENGTH_DAYS));
    this._setDeleteVisible(false);
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
    this._restDays = new Set((program.restDays || []).map(Number));
    this._notes = program.notes || '';

    // Filtered reads: rows never show a routine or activity that no longer exists.
    this._dayItems = new Map();
    getProgramScheduledDays(programId).forEach((day) => {
      const key = Number(day.dayOfWeek);
      if (!this._dayItems.has(key)) this._dayItems.set(key, []);
      this._dayItems
        .get(key)
        .push(
          day.activityId
            ? { type: 'activity', id: day.activityId }
            : { type: 'routine', id: day.routineId }
        );
    });

    this._setTitle('Edit Program');
    this._setName(program.name || '');
    this._setDates(program.startDate, program.endDate);
    this._setDeleteVisible(true);
    this._renderAll();
    openModal(MODAL_ID);
  },

  /**
   * Closes the builder.
   * @returns {void}
   */
  close() {
    closeDayAddMenu();
    closeModal(MODAL_ID);
  },

  /**
   * Re-renders every dynamic section and revalidates.
   * @returns {void}
   */
  _renderAll() {
    this._renderRestDays();
    this._renderSchedule();
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
   * Builds the seven rest-day buttons, matching the habits day picker.
   * @returns {void}
   */
  _renderRestDays() {
    const grid = document.getElementById('program-rest-day-grid');
    if (!grid) return;

    if (grid.childElementCount === 0) {
      grid.innerHTML = ROW_ORDER.map(
        (index) => `
        <button type="button" class="day-button program-rest-day flex-1 h-12 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium text-sm hover:border-ios-blue transition-colors" data-day="${index}" aria-label="${ROW_LABELS[index]} rest day" aria-pressed="false">${DAY_LABELS[index]}</button>
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
      this._dayItems.delete(dayOfWeek);
    }
    this._renderRestDays();
    this._renderSchedule();
    this._validate();
  },

  /**
   * Renders one row per non-rest weekday. Each pinned routine or activity is its
   * own tile, with the add button sitting immediately after the last one rather
   * than pushed to the far edge, so the row reads as a single growing list.
   * @returns {void}
   */
  _renderSchedule() {
    const host = document.getElementById('program-schedule-rows');
    if (!host) return;

    closeDayAddMenu();

    const activeDays = ROW_ORDER.filter((day) => !this._restDays.has(day));
    document
      .getElementById('program-all-rest-notice')
      ?.classList.toggle('hidden', activeDays.length > 0);

    host.innerHTML = activeDays.map((day) => this._buildDayRow(day)).join('');

    host.querySelectorAll('.program-day-item-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._removeDayItem(Number(btn.dataset.dayOfWeek), Number(btn.dataset.index));
      });
    });
    host.querySelectorAll('.program-day-add').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        this._openDayAddMenu(btn, Number(btn.dataset.dayOfWeek));
      });
    });
  },

  /**
   * Builds one weekday row.
   * @param {number} day - 0 = Sunday
   * @returns {string} Row markup.
   */
  _buildDayRow(day) {
    const items = this._dayItems.get(day) || [];
    const tiles = items
      .map((item, index) => this._buildDayItemTile(item, day, index))
      .filter(Boolean)
      .join('');

    // Two columns: the weekday on the left, everything pinned to it on the
    // right. The tiles and the + share one wrapping container, so the + sits in
    // line with "Mon" on an empty day, trails the last tile once the day fills
    // up, and a row that wraps keeps its second line clear of the day column.
    return `
      <div class="program-day-row flex items-start gap-2" data-day-of-week="${day}">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 w-9 h-9 flex-shrink-0 flex items-center">${ROW_LABELS[day]}</span>
        <div class="flex flex-wrap items-center gap-2 min-w-0 flex-grow">
          ${tiles}
          <span class="relative inline-flex">
            <button type="button" class="program-day-add w-9 h-9 rounded-xl bg-ios-blue/10 text-ios-blue flex items-center justify-center hover:bg-ios-blue/20 transition-colors focus:outline-none focus:ring-2 focus:ring-ios-blue/50" data-day-of-week="${day}" aria-haspopup="menu" aria-expanded="false" aria-label="Add to ${FULL_DAY_NAMES[day]}">
              <span class="material-icons text-xl">add</span>
            </button>
          </span>
        </div>
      </div>
    `;
  },

  /**
   * Builds a single pinned-item tile.
   * @param {{type: string, id: string}} item - The pinned routine or activity
   * @param {number} day - Weekday the tile belongs to
   * @param {number} index - Position within the day, used as the remove target
   * @returns {string} Tile markup, or an empty string when the target is gone.
   */
  _buildDayItemTile(item, day, index) {
    const presentation = programItemPresentation(item);
    if (!presentation) return '';
    const { name, color, iconHTML } = presentation;

    return `
      <span class="program-day-item inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-xl text-sm font-medium text-gray-900 dark:text-white max-w-full" style="border:2px solid ${color}; background-color:${hexToRgba(color, 0.12)};">
        ${iconHTML}
        <span class="truncate">${name}</span>
        <button type="button" class="program-day-item-remove w-5 h-5 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex-shrink-0" data-day-of-week="${day}" data-index="${index}" aria-label="Remove ${name} from ${FULL_DAY_NAMES[day]}">
          <span class="material-icons text-sm">close</span>
        </button>
      </span>
    `;
  },

  /**
   * Drops one pinned item from a day.
   * @param {number} dayOfWeek - 0 = Sunday
   * @param {number} index - Position within the day
   * @returns {void}
   */
  _removeDayItem(dayOfWeek, index) {
    const items = this._dayItems.get(dayOfWeek);
    if (!items) return;
    items.splice(index, 1);
    if (items.length === 0) this._dayItems.delete(dayOfWeek);
    this._renderSchedule();
    this._validate();
  },

  /**
   * Offers the choice between adding an activity and adding a routine, anchored
   * to the day's add button.
   * @param {HTMLElement} button - The add button
   * @param {number} dayOfWeek - 0 = Sunday
   * @returns {void}
   */
  _openDayAddMenu(button, dayOfWeek) {
    openDayAddMenu(button, {
      onAddActivity: () => this._openDayActivityPicker(dayOfWeek),
      onAddRoutine: () => this._openDayRoutinePicker(dayOfWeek),
    });
  },

  /**
   * Opens the routine picker for one weekday, seeded with that day's routines.
   * Confirming replaces the day's routines and leaves its activities alone.
   * @param {number} dayOfWeek - 0 = Sunday
   * @returns {void}
   */
  _openDayRoutinePicker(dayOfWeek) {
    RoutinePickerModal.open({
      selectedIds: this._idsOfType(dayOfWeek, 'routine'),
      title: `${FULL_DAY_NAMES[dayOfWeek]} Routines`,
      confirmLabel: 'Done',
      allowEmpty: true,
      onConfirm: (routineIds) => this._replaceDayItems(dayOfWeek, 'routine', routineIds),
    });
  },

  /**
   * Opens the activity picker for one weekday, seeded with that day's activities.
   * Confirming replaces the day's activities and leaves its routines alone.
   * @param {number} dayOfWeek - 0 = Sunday
   * @returns {void}
   */
  _openDayActivityPicker(dayOfWeek) {
    ActivityPickerModal.open({
      selectedIds: this._idsOfType(dayOfWeek, 'activity'),
      title: `${FULL_DAY_NAMES[dayOfWeek]} Activities`,
      confirmLabel: 'Done',
      allowEmpty: true,
      onConfirm: (activityIds) => this._replaceDayItems(dayOfWeek, 'activity', activityIds),
    });
  },

  /**
   * @param {number} dayOfWeek - 0 = Sunday
   * @param {string} type - 'routine' or 'activity'
   * @returns {string[]} The day's ids of that type, in order.
   */
  _idsOfType(dayOfWeek, type) {
    return (this._dayItems.get(dayOfWeek) || [])
      .filter((item) => item.type === type)
      .map((item) => item.id);
  },

  /**
   * Swaps out every item of one type on a day, keeping the other type in place.
   * @param {number} dayOfWeek - 0 = Sunday
   * @param {string} type - 'routine' or 'activity'
   * @param {string[]} ids - The new ids of that type, in order
   * @returns {void}
   */
  _replaceDayItems(dayOfWeek, type, ids) {
    const kept = (this._dayItems.get(dayOfWeek) || []).filter((item) => item.type !== type);
    const next = [...kept, ...ids.map((id) => ({ type, id }))];
    if (next.length === 0) this._dayItems.delete(dayOfWeek);
    else this._dayItems.set(dayOfWeek, next);
    this._renderSchedule();
    this._validate();
  },

  /**
   * Flattens the pinned day map into the stored schedule shape.
   * @returns {Array<{dayOfWeek: number, routineId?: string, activityId?: string}>} Schedule entries.
   */
  _collectSchedule() {
    const entries = [];
    ROW_ORDER.forEach((day) => {
      if (this._restDays.has(day)) return;
      (this._dayItems.get(day) || []).forEach((item) => {
        entries.push(
          item.type === 'activity'
            ? { dayOfWeek: day, activityId: item.id }
            : { dayOfWeek: day, routineId: item.id }
        );
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

    const hasSchedule = this._collectSchedule().length > 0;

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
    if (!name || !start || !end || start > end) return;
    if (scheduledDays.length === 0) return;

    const payload = {
      name,
      startDate: start,
      endDate: end,
      restDays: [...this._restDays],
      scheduledDays,
      notes: this._notes,
    };

    // Two blocks covering the same days would both claim those days, so make the
    // clash a decision rather than something the user discovers later.
    const clashes = findOverlappingPrograms(start, end, this._editProgramId);
    if (clashes.length > 0) {
      this._promptDateConflict(clashes, payload);
      return;
    }

    await this._persist(payload);
  },

  /**
   * Offers the ways out of a date clash: edit the block already covering those
   * days, replace it with this one, or back out.
   * @param {object[]} clashes - Overlapping programs
   * @param {object} payload - The program about to be saved
   * @returns {void}
   */
  _promptDateConflict(clashes, payload) {
    const names = clashes.map((program) => `"${program.name}"`).join(', ');
    const plural = clashes.length > 1;

    showChoice({
      title: 'Conflicting Dates',
      message: `${names} already ${plural ? 'cover' : 'covers'} some of these days. Two programs cannot run over the same dates.`,
      actions: [
        {
          label: plural ? 'Replace them with this one' : 'Replace it with this one',
          destructive: true,
          onSelect: async () => {
            for (const program of clashes) {
              // Sequential, matching the rest of the outbox writes.
              // eslint-disable-next-line no-await-in-loop
              const deleted = await deleteProgram(program.id);
              if (!deleted) return;
            }
            await this._persist(payload);
          },
        },
        {
          label: plural ? `Edit "${clashes[0].name}" instead` : `Edit ${names} instead`,
          onSelect: () => {
            const onSaved = this._onSaved;
            this.openEditMode(clashes[0].id, { onSaved });
          },
        },
      ],
    });
  },

  /**
   * Writes the program, activates it and closes the builder.
   * @param {object} payload - Program fields to persist
   * @returns {Promise<void>}
   */
  async _persist(payload) {
    let programId = this._editProgramId;
    if (programId) {
      // Edits apply from today: what the block planned before that is closed off
      // as a phase, so past weeks keep the sessions they were measured against.
      const saved = await updateProgramPlan(programId, payload);
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
