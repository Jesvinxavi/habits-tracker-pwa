// ProgramDetailsModal.js - What the program tile opens: an overview of the block
import { closeModal, isModalOpen, openModal, topModalId } from '../../../components/Modal.js';
import { showConfirm } from '../../../components/ConfirmDialog.js';
import { subscribe } from '../../../core/state.js';
import { getLocalISODate } from '../../../shared/datetime.js';
import { hexToRgba } from '../../../shared/color.js';
import { escapeHtml, normalizeHexColor } from '../../../shared/sanitize.js';
import { shallowArrayEqual } from '../../../shared/equality.js';
import { getRoutine, getRoutineActivities } from '../routines.js';
import { getActivity, getActivityCategory } from '../activities.js';
import { isRestDay } from '../../../shared/restDays.js';
import {
  getProgram,
  getProgramProgress,
  updateProgram,
  addProgramRoutinesToDate,
} from '../programs.js';
import { programItemPresentation } from '../helpers/programItems.js';
import { dateRangeLabel, weekLabel, dayLabel, shortDayLabel } from '../helpers/programLabels.js';
import { ensureFitnessModalMarkup } from '../FitnessModalMarkup.js';

const MODAL_ID = 'program-details-modal';
const PILL_COLOR = '#0060C7';
// Progress bars are graded rather than one colour: a third of the way through is
// a different situation from nearly done, and the bar should say so at a glance.
// green-700 is the shade the ticked tiles use, so a finished week's bar and its
// ticks read as the same state.
const BEHIND_COLOR = '#DC2626'; // red-600
const PARTIAL_COLOR = '#B45309'; // amber-700
const DONE_COLOR = '#15803D'; // green-700
// ios-orange, the colour the fitness page's rest toggle turns when a day is
// marked as rest. Tinted rather than solid, with orange-800 text: white on
// ios-orange is 2.1:1 and orange-700 lands at 4.48:1, both under AA for an
// 11px chip.
const REST_COLOR = '#FF9500';
const NOTES_DEBOUNCE_MS = 600;

/**
 * Picks the bar colour for a completion figure.
 * @param {number} percent Completion, 0-100.
 * @returns {string} Hex colour.
 */
function barColor(percent) {
  if (percent <= 33) return BEHIND_COLOR;
  if (percent <= 66) return PARTIAL_COLOR;
  return DONE_COLOR;
}

/**
 * ProgramDetailsModal - the program tile's destination.
 *
 * Shows what the block is, how far through it the user is and what the next
 * session holds, and keeps the two actions that act on the program — pulling a
 * day in, and editing the plan — behind explicit buttons.
 */
export const ProgramDetailsModal = {
  _programId: null,
  _unsubscribe: null,
  _notesTimer: null,
  // The one week whose day list is open, or null. Held on the modal rather than
  // in the markup, so the re-render a fresh record triggers does not collapse
  // the week the user is reading.
  _expandedWeek: null,
  // Weeks after the current one start hidden: the block ahead is a plan, not
  // something to scroll past on the way to what is happening now.
  _showFutureWeeks: false,

  /**
   * Opens the details view for a program.
   * @param {string} programId - Program client id
   * @returns {void}
   */
  open(programId) {
    const program = getProgram(programId);
    if (!program) return;
    ensureFitnessModalMarkup(MODAL_ID);

    this._bindStaticHandlers();
    this._programId = programId;
    // The week in progress is the one the user came to look at.
    this._expandedWeek = getProgramProgress(program).week;
    this._showFutureWeeks = false;
    this._render();

    // Adding the day's session from here changes the progress figures behind the
    // modal, so keep it live while open.
    if (!this._unsubscribe) {
      this._unsubscribe = subscribe(
        (state) => [
          state.programs,
          state.routines,
          state.activities,
          state.activityCategories,
          state.recordedActivities,
          state.restDays,
        ],
        () => {
          if (isModalOpen(MODAL_ID)) this._render({ keepNotes: true });
        },
        { equalityFn: shallowArrayEqual }
      );
    }

    openModal(MODAL_ID);
  },

  /**
   * Flushes any pending note edit and closes the modal.
   * @returns {void}
   */
  close() {
    this._flushNotes();
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    closeModal(MODAL_ID);
  },

  /**
   * Paints the modal from the current program and selected date.
   * @param {Object} [options] - Render options
   * @param {boolean} [options.keepNotes] - Leave the notes field alone, so a
   *   re-render triggered by the user's own typing does not fight the caret
   * @returns {void}
   */
  _render({ keepNotes = false } = {}) {
    const program = getProgram(this._programId);
    if (!program) {
      this.close();
      return;
    }

    const progress = getProgramProgress(program);

    const name = document.getElementById('program-details-name');
    if (name) name.textContent = program.name;

    const range = document.getElementById('program-details-range');
    if (range) {
      range.textContent = dateRangeLabel(program.startDate, program.endDate);
      range.style.backgroundColor = PILL_COLOR;
    }

    const week = document.getElementById('program-details-week');
    if (week) {
      week.textContent = weekLabel(progress);
      week.style.border = `1px solid ${PILL_COLOR}`;
    }

    const percent = document.getElementById('program-details-percent');
    if (percent) percent.textContent = `${progress.percent}%`;

    const track = document.getElementById('program-details-bar-track');
    if (track) {
      track.setAttribute('aria-valuenow', String(progress.percent));
      track.setAttribute(
        'aria-valuetext',
        `${progress.completedWorkouts} of ${progress.plannedWorkouts} workouts completed`
      );
    }

    const bar = document.getElementById('program-details-bar');
    if (bar) {
      bar.style.width = `${Math.max(0, Math.min(progress.percent, 100))}%`;
      bar.style.backgroundColor = barColor(progress.percent);
    }

    const workouts = document.getElementById('program-details-workouts');
    if (workouts) {
      workouts.textContent = `${progress.completedWorkouts} of ${progress.plannedWorkouts} planned workouts completed`;
    }

    this._renderWeeks(progress);
    this._renderSession(progress);

    const notes = document.getElementById('program-details-notes');
    if (notes && !keepNotes) notes.value = program.notes || '';
  },

  /**
   * Renders one pill per week of the block, each opening onto the days it
   * plans and what has been ticked off them.
   * @param {object} progress - Computed progress, including its week breakdown
   * @returns {void}
   */
  _renderWeeks(progress) {
    const host = document.getElementById('program-details-weeks');
    if (!host) return;

    // Everything up to and including the week in progress is shown; the plan
    // ahead waits behind a disclosure. A finished block has no future weeks, so
    // the whole thing is on show.
    const throughCurrent = progress.phase === 'after' ? progress.totalWeeks : progress.week;
    const visible = this._showFutureWeeks
      ? progress.weeks
      : progress.weeks.filter((week) => week.index <= throughCurrent);

    host.innerHTML = visible.map((week) => this._buildWeek(week, progress)).join('');

    const more = document.getElementById('program-details-more-weeks-btn');
    if (!more) return;

    const hidden = progress.weeks.length - throughCurrent;
    const hasFuture = hidden > 0;
    more.classList.toggle('hidden', !hasFuture);
    more.classList.toggle('flex', hasFuture);
    if (!hasFuture) return;

    more.setAttribute('aria-expanded', String(this._showFutureWeeks));
    more.innerHTML = this._showFutureWeeks
      ? '<span class="material-icons text-lg" aria-hidden="true">expand_less</span>Show fewer weeks'
      : `<span class="material-icons text-lg" aria-hidden="true">expand_more</span>Show ${hidden} later ${hidden === 1 ? 'week' : 'weeks'}`;
  },

  /**
   * Builds one week: the pill that summarises it, and the day list it opens.
   * @param {object} week - One entry from the progress week breakdown
   * @param {object} progress - The whole progress result, for the current week
   * @returns {string} Week markup.
   */
  _buildWeek(week, progress) {
    const expanded = this._expandedWeek === week.index;
    const complete = week.planned > 0 && week.completed === week.planned;
    const isCurrent = progress.phase === 'during' && week.index === progress.week;
    const panelId = `program-week-panel-${week.index}`;

    // The current week is outlined in the program's own blue, so the week the
    // user is living in is findable without reading any of the labels.
    const outline = isCurrent
      ? `style="border-color:${PILL_COLOR};"`
      : '';

    const summary = `Week ${week.index}, ${week.completed} of ${week.planned} sessions completed`;

    return `
      <div class="program-week rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 overflow-hidden" ${outline}>
        <button type="button" class="program-week-pill w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors" data-week="${week.index}" aria-expanded="${expanded}" aria-controls="${panelId}" aria-label="${summary}">
          <span class="flex items-center gap-2">
            <span class="material-icons text-base text-gray-500 dark:text-gray-400 flex-shrink-0" aria-hidden="true">${expanded ? 'expand_more' : 'chevron_right'}</span>
            <span class="text-sm font-semibold text-gray-900 dark:text-white flex-shrink-0">Week ${week.index}</span>
            <span class="text-[11px] text-gray-500 dark:text-gray-400 truncate">${dateRangeLabel(week.start, week.end)}</span>
            <span class="ml-auto flex items-center gap-1 flex-shrink-0">
              ${complete ? '<span class="material-icons text-base text-green-700 dark:text-green-400" aria-hidden="true">check_circle</span>' : ''}
              <span class="text-xs font-bold ${complete ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}">${week.completed}/${week.planned}</span>
            </span>
          </span>
          <span class="block mt-1.5 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden" aria-hidden="true">
            <span class="block h-full rounded-full transition-[width] duration-300" style="width:${Math.max(0, Math.min(week.percent, 100))}%;background-color:${barColor(week.percent)};"></span>
          </span>
        </button>
        <div id="${panelId}" class="px-3 pb-3 pt-1 space-y-2 ${expanded ? '' : 'hidden'}">
          ${this._buildWeekDays(week)}
        </div>
      </div>
    `;
  },

  /**
   * Builds the day rows inside a week, laid out like the builder's schedule.
   * @param {object} week - One entry from the progress week breakdown
   * @returns {string} Day-row markup.
   */
  _buildWeekDays(week) {
    if (week.days.length === 0) {
      return '<p class="text-xs text-gray-600 dark:text-gray-400">Nothing is scheduled this week.</p>';
    }

    const todayISO = getLocalISODate(new Date());

    return week.days
      .map((day) => {
        const isToday = day.date === todayISO;
        // The label is its own column rather than the first item in a wrapping
        // row, so a day whose tiles wrap keeps them aligned under each other
        // instead of tucking the second line under the weekday.
        return `
          <div class="program-week-day flex items-start gap-2" data-date="${day.date}">
            <span class="w-9 h-8 flex-shrink-0 flex items-center text-sm font-medium ${isToday ? 'text-ios-blue font-semibold' : 'text-gray-700 dark:text-gray-300'}">${shortDayLabel(day.date)}</span>
            <div class="flex flex-wrap items-center gap-2 min-w-0">
              ${day.isRestDay ? `<span class="px-2 py-1 rounded-lg text-[11px] font-semibold text-orange-800 dark:text-orange-300" style="background-color:${hexToRgba(REST_COLOR, 0.18)};">Rest</span>` : ''}
              ${day.slots.map((slot) => this._buildSlotTile(slot)).join('')}
            </div>
          </div>
        `;
      })
      .join('');
  },

  /**
   * Builds one scheduled item as it stands: ticked off, or still open.
   * @param {object} slot - A slot from the week breakdown
   * @returns {string} Tile markup, or an empty string when the target is gone.
   */
  _buildSlotTile(slot) {
    const presentation = programItemPresentation(slot);
    if (!presentation) return '';
    const { name, color, iconHTML } = presentation;

    if (!slot.done) {
      return `
        <span class="program-week-item inline-flex items-center gap-1.5 px-2 py-1 rounded-xl text-sm font-medium text-gray-900 dark:text-white max-w-full" style="border:2px solid ${color}; background-color:${hexToRgba(color, 0.08)};">
          ${iconHTML}
          <span class="truncate">${name}</span>
        </span>
      `;
    }

    // A tick earned on another day says which one: the session still counted,
    // and the user should be able to see where it came from.
    const elsewhere =
      slot.doneDate && slot.doneDate !== slot.date
        ? `<span class="text-[11px] font-normal text-green-700 dark:text-green-400 flex-shrink-0">${shortDayLabel(slot.doneDate)}</span>`
        : '';

    return `
      <span class="program-week-item is-done inline-flex items-center gap-1.5 px-2 py-1 rounded-xl text-sm font-medium text-gray-900 dark:text-white max-w-full border-2 border-green-600 dark:border-green-400 bg-green-500/10">
        <span class="material-icons text-base leading-none text-green-700 dark:text-green-400 flex-shrink-0" aria-hidden="true">check_circle</span>
        <span class="truncate line-through decoration-green-700/50 dark:decoration-green-400/50">${name}</span>
        ${elsewhere}
      </span>
    `;
  },

  /**
   * Renders the session block: today's outstanding work, or the next day that
   * still has some.
   *
   * Read from the same allocation the week view uses, so the card and the ticks
   * can never disagree. What matters is whether *this program's* items are done,
   * not whether the day holds records: training something else on Tuesday leaves
   * Tuesday's session outstanding, and the card keeps asking for it.
   *
   * Always anchored to **today**, never to the day the fitness page happens to
   * be showing — the card answers "what am I doing now", and scrolling the page
   * back to last Tuesday should not change that answer. A rest day or a gap in
   * the schedule reads as what is coming rather than as a dead end.
   * @param {object} progress - Computed progress, including its week breakdown
   * @returns {void}
   */
  _renderSession(progress) {
    const host = document.getElementById('program-details-session');
    const heading = document.getElementById('program-details-session-heading');
    if (!host) return;

    const todayISO = this._todayISO();
    const outstanding = progress.weeks
      .flatMap((week) => week.days)
      .map((day) => ({ date: day.date, items: day.slots.filter((slot) => !slot.done) }))
      .filter((day) => day.items.length > 0);

    // A day the user has declared a rest day is not somewhere to add work, so
    // today only counts as actionable when it is not one.
    const today = isRestDay(todayISO)
      ? null
      : outstanding.find((day) => day.date === todayISO);
    const target = today || outstanding.find((day) => day.date > todayISO) || null;

    if (heading) {
      if (today) heading.textContent = 'Scheduled for today';
      else heading.textContent = target ? 'Next session' : 'Scheduled';
    }

    // Pulling the program in only makes sense for a day that still owes something.
    document.getElementById('program-details-add-today-btn')?.classList.toggle('hidden', !today);

    if (!target) {
      host.innerHTML = `
        <p class="text-xs text-gray-600 dark:text-gray-400">Nothing else is scheduled in this block.</p>
      `;
      return;
    }

    const dayHeading =
      target.date === todayISO
        ? ''
        : `<p class="text-xs font-medium text-gray-500 dark:text-gray-400">${escapeHtml(dayLabel(target.date))}</p>`;

    host.innerHTML = `
      <div class="space-y-2">
        ${dayHeading}
        ${target.items.map((item) => this._buildSessionRow(item)).join('')}
      </div>
    `;
  },

  /**
   * Builds one row describing a scheduled routine or activity.
   * @param {{type: string, id: string}} item - The scheduled item
   * @returns {string} Row markup.
   */
  _buildSessionRow(item) {
    if (item.type === 'activity') {
      const activity = getActivity(item.id);
      if (!activity) return '';
      const category = getActivityCategory(activity.categoryId);
      const color = normalizeHexColor(category?.color, PILL_COLOR);
      return `
        <div class="flex items-center px-3 py-2 rounded-xl" style="border:2px solid ${color}; background-color:${hexToRgba(color, 0.08)};">
          <span class="w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center mr-3 text-xl" style="background-color:${color}20;" aria-hidden="true">${escapeHtml(activity.icon || category?.icon || '🎯')}</span>
          <div class="min-w-0">
            <div class="font-semibold leading-tight text-gray-900 dark:text-white truncate">${escapeHtml(activity.name)}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(category?.name || 'Activity')}</div>
          </div>
        </div>
      `;
    }

    const routine = getRoutine(item.id);
    if (!routine) return '';
    const count = getRoutineActivities(routine.id).length;
    return `
      <div class="flex items-center px-3 py-2 rounded-xl bg-ios-blue/10" style="border:2px solid ${PILL_COLOR};">
        <span class="w-8 h-8 flex-shrink-0 rounded-lg bg-white/70 dark:bg-gray-800/70 flex items-center justify-center mr-3" aria-hidden="true">
          <span class="material-icons text-ios-blue text-lg">repeat</span>
        </span>
        <div class="min-w-0">
          <div class="font-semibold leading-tight text-gray-900 dark:text-white truncate">${escapeHtml(routine.name)}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">${count} ${count === 1 ? 'activity' : 'activities'}</div>
        </div>
      </div>
    `;
  },

  /**
   * @returns {string} Today's date key.
   */
  _todayISO() {
    return getLocalISODate(new Date());
  },

  /**
   * Writes the note straight away, cancelling any debounce still pending.
   * @returns {void}
   */
  _flushNotes() {
    if (this._notesTimer) {
      clearTimeout(this._notesTimer);
      this._notesTimer = null;
    }
    const program = getProgram(this._programId);
    const notes = document.getElementById('program-details-notes');
    if (!program || !notes) return;
    const value = notes.value.trim();
    if ((program.notes || '') === value) return;
    void updateProgram(program.id, { notes: value });
  },

  /**
   * Records the program's session for today, explaining itself when there is
   * nothing to add. Today, not the selected day, to match the card above it.
   * @returns {Promise<void>}
   */
  async _handleAddToToday() {
    const iso = this._todayISO();

    if (isRestDay(iso)) {
      showConfirm({
        title: 'Rest Day',
        message: 'Unable to record activity as today is a rest day.',
        okText: 'OK',
        cancelText: '',
        onOK: () => {},
      });
      return;
    }

    // Only what is missing is written, so a day already holding other training
    // still gets its session — nothing is stacked twice.
    const result = await addProgramRoutinesToDate(iso);
    if (result.recorded > 0 || result.blocked) return;

    showConfirm({
      title: result.scheduled > 0 ? 'Already Logged' : 'Nothing Scheduled',
      message:
        result.scheduled > 0
          ? 'Everything this program schedules for today is already recorded.'
          : 'This program schedules nothing for today.',
      okText: 'OK',
      cancelText: '',
      onOK: () => {},
    });
  },

  /**
   * Binds handlers to markup that lives for the page's lifetime.
   * @returns {void}
   */
  _bindStaticHandlers() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal || modal.dataset.listenerAttached) return;

    document.getElementById('close-program-details')?.addEventListener('click', () => this.close());

    document.getElementById('program-details-add-today-btn')?.addEventListener('click', () => {
      void this._handleAddToToday();
    });

    // Delegated: the week list is rebuilt on every render, so per-pill listeners
    // would have to be rebound each time.
    document.getElementById('program-details-weeks')?.addEventListener('click', (event) => {
      const pill = event.target.closest('.program-week-pill');
      if (!pill) return;
      // One week open at a time: the point of the list is to compare weeks, and
      // several expanded at once buries the pills between long day lists.
      const index = Number(pill.dataset.week);
      this._expandedWeek = this._expandedWeek === index ? null : index;
      this._render({ keepNotes: true });
    });

    document.getElementById('program-details-more-weeks-btn')?.addEventListener('click', () => {
      this._showFutureWeeks = !this._showFutureWeeks;
      this._render({ keepNotes: true });
    });

    document.getElementById('program-details-edit-btn')?.addEventListener('click', () => {
      this._flushNotes();
      // The builder opens on top; closing it drops back to these details, which
      // the state subscription has already refreshed.
      import('./ProgramBuilderModal.js').then(({ ProgramBuilderModal }) => {
        ProgramBuilderModal.openEditMode(this._programId, {
          onSaved: () => {
            if (getProgram(this._programId)) this._render();
            else this.close();
          },
        });
      });
    });

    const notes = document.getElementById('program-details-notes');
    notes?.addEventListener('input', () => {
      if (this._notesTimer) clearTimeout(this._notesTimer);
      this._notesTimer = setTimeout(() => {
        this._notesTimer = null;
        this._flushNotes();
      }, NOTES_DEBOUNCE_MS);
    });
    notes?.addEventListener('blur', () => this._flushNotes());

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
