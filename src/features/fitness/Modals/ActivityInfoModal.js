// ActivityInfoModal.js - Read-only overview of one activity
import { closeModal, isModalOpen, openModal, topModalId } from '../../../components/Modal.js';
import { subscribe } from '../../../core/state.js';
import { getActivity, getActivityCategory, updateActivity } from '../activities.js';
import { buildProgressCard } from '../helpers/activityStats.js';

const MODAL_ID = 'activity-info-modal';
// Long enough that typing a sentence commits once rather than per keystroke,
// short enough that closing the modal straight after typing still saves.
const NOTES_DEBOUNCE_MS = 600;

/**
 * ActivityInfoModal - what tapping an activity tile in the library opens.
 *
 * Deliberately not a recording surface: it describes the activity, charts its
 * progress and hands off to the record modal, the editor and the statistics
 * modal. Recording lives behind an explicit button so tapping a tile can never
 * write a session by accident.
 */
export const ActivityInfoModal = {
  _activityId: null,
  _callbacks: {},
  _unsubscribe: null,
  _notesTimer: null,

  /**
   * Opens the details view for an activity.
   * @param {string} activityId - Activity client id
   * @param {Object} [callbacks] - Navigation handlers
   * @param {Function} [callbacks.onRecord] - Opens the record modal for this activity
   * @param {Function} [callbacks.onEdit] - Opens the activity editor
   * @param {Function} [callbacks.onStats] - Opens the statistics modal
   * @returns {void}
   */
  open(activityId, callbacks = {}) {
    if (!getActivity(activityId)) return;

    this._bindStaticHandlers();
    this._activityId = activityId;
    this._callbacks = callbacks;
    this._render();

    // Recording from this modal changes the chart underneath it, so keep the
    // view live while it is open and drop the listener on close.
    if (!this._unsubscribe) {
      this._unsubscribe = subscribe(() => {
        if (isModalOpen(MODAL_ID)) this._render({ keepNotes: true });
      });
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
   * Paints the modal from the current activity.
   * @param {Object} [options] - Render options
   * @param {boolean} [options.keepNotes] - Leave the notes field alone, so a
   *   re-render triggered by the user's own typing does not fight the caret
   * @returns {void}
   */
  _render({ keepNotes = false } = {}) {
    const activity = getActivity(this._activityId);
    // An archived activity has no details left to show. This also covers
    // deleting from the editor, which would otherwise leave this modal sitting
    // in front of the library describing something the user just removed.
    if (!activity || activity.archivedAt) {
      this.close();
      return;
    }

    const category = getActivityCategory(activity.categoryId) || {};

    const icon = document.getElementById('activity-info-icon');
    if (icon) {
      icon.textContent = activity.icon || category.icon || '🎯';
      icon.style.backgroundColor = `${category.color || '#3b82f6'}20`;
    }

    const name = document.getElementById('activity-info-name');
    if (name) name.textContent = activity.name;

    const categoryEl = document.getElementById('activity-info-category');
    if (categoryEl) categoryEl.textContent = category.name || '';

    const progress = document.getElementById('activity-info-progress');
    if (progress) progress.innerHTML = buildProgressCard(activity, category);

    const notes = document.getElementById('activity-info-notes');
    if (notes && !keepNotes) notes.value = activity.notes || '';
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
    const activity = getActivity(this._activityId);
    const notes = document.getElementById('activity-info-notes');
    if (!activity || !notes) return;
    const value = notes.value.trim();
    if ((activity.notes || '') === value) return;
    void updateActivity(activity.id, { notes: value });
  },

  /**
   * Binds handlers to markup that lives for the page's lifetime.
   * @returns {void}
   */
  _bindStaticHandlers() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal || modal.dataset.listenerAttached) return;

    document.getElementById('close-activity-info')?.addEventListener('click', () => this.close());

    document.getElementById('activity-info-edit-btn')?.addEventListener('click', () => {
      this._flushNotes();
      this._callbacks.onEdit?.(this._activityId);
    });

    document.getElementById('activity-info-stats-btn')?.addEventListener('click', () => {
      this._callbacks.onStats?.(this._activityId);
    });

    document.getElementById('activity-info-record-btn')?.addEventListener('click', () => {
      this._flushNotes();
      this._callbacks.onRecord?.(this._activityId);
    });

    const notes = document.getElementById('activity-info-notes');
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

    // An edit that renames or recolours the activity should show through here.
    document.addEventListener('modalClosed', (event) => {
      if (event.detail?.modalId !== 'add-activity-modal') return;
      if (isModalOpen(MODAL_ID)) this._render({ keepNotes: true });
    });

    // Deleting the activity from the editor leaves nothing to describe.
    document.addEventListener('ActivityDeleted', () => {
      if (isModalOpen(MODAL_ID)) this.close();
    });

    modal.dataset.listenerAttached = 'true';
  },
};
