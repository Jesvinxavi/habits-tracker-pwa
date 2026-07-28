// ActivityLibraryModal.js - The categorised activity list, as a modal
import { closeModal, isModalOpen, openModal, topModalId } from '../../../components/Modal.js';
import { dispatch, Actions, subscribe } from '../../../core/state.js';
import {
  buildCategorySection,
  bindCategorySectionEvents,
} from '../ActivityLibrary/CategorySection.js';
import {
  bindActivityTileEvents,
  bindSearchKeyboardNavigation,
} from '../ActivityLibrary/ActivityTile.js';
import {
  openCategoryColorPicker,
  updateSearchCategoryButton,
} from '../ActivityLibrary/CategoryColorPicker.js';
import {
  getActivitiesByCategory,
  searchActivities,
  getActivityCategory,
  groupActivitiesByMuscleGroup,
} from '../activities.js';

const MODAL_ID = 'activity-library-modal';

/**
 * ActivityLibraryModal - lists every activity grouped by category, with an
 * always-visible filter that narrows the list in place.
 */
export const ActivityLibraryModal = {
  _callbacks: {},
  _unsubscribe: null,
  // Category ids the user has expanded. The list re-renders on every state
  // change while open, so without this a recorded activity would snap every
  // section shut underneath the user.
  _expanded: new Set(),

  /**
   * Opens the library.
   * @param {Object} callbacks - Handlers for tile interactions
   * @param {Function} callbacks.onActivityClick - Called when an activity tile is tapped
   * @returns {void}
   */
  open(callbacks = {}) {
    this._callbacks = callbacks;
    this._bindStaticHandlers();
    // Every visit starts on the collapsed category list.
    this._expanded.clear();

    const filter = document.getElementById('activity-library-filter');
    if (filter) filter.value = '';
    this._toggleClearButton('');
    this._render('');

    // Keep the list live while open, and drop the listener on close so opening
    // the library repeatedly does not leak subscriptions.
    if (!this._unsubscribe) {
      this._unsubscribe = subscribe(() => {
        if (isModalOpen(MODAL_ID)) this.refresh();
      });
    }

    openModal(MODAL_ID);
  },

  /**
   * Closes the library and releases its state subscription.
   * @returns {void}
   */
  close() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    closeModal(MODAL_ID);
  },

  /**
   * Re-renders the list using the current filter value.
   * @returns {void}
   */
  refresh() {
    this._render(this._currentQuery());
  },

  /**
   * @returns {string} The current filter text.
   */
  _currentQuery() {
    return document.getElementById('activity-library-filter')?.value || '';
  },

  /**
   * Shows the clear button only when the filter holds text.
   * @param {string} value - Current filter value
   * @returns {void}
   */
  _toggleClearButton(value) {
    const clearBtn = document.getElementById('activity-library-filter-clear');
    if (clearBtn) clearBtn.classList.toggle('hidden', value.length === 0);
  },

  /**
   * Renders the grouped activity list into the modal body.
   * @param {string} query - Filter text; empty shows every category
   * @returns {void}
   */
  _render(query = '') {
    const content = document.getElementById('activity-library-content');
    if (!content) return;

    let html = '';

    if (query.trim() === '') {
      // Show all activities grouped by category, collapsed: the unfiltered
      // library opens as a list of categories to drill into. A search is an
      // explicit request to see matches, so filtered sections stay expanded.
      const groupedActivities = getActivitiesByCategory();

      Object.values(groupedActivities).forEach(({ category, activities }) => {
        if (activities.length === 0) return;

        const collapsed = !this._expanded.has(category.id);
        // Special handling for Strength Training – show muscle group sub-headers
        if (category.id === 'strength') {
          html += buildCategorySection(
            category,
            null,
            groupActivitiesByMuscleGroup(activities),
            collapsed
          );
        } else {
          html += buildCategorySection(category, activities, null, collapsed);
        }
      });
    } else {
      // Filter activities, then re-group the matches by category
      const matches = searchActivities(query);

      if (matches.length > 0) {
        const filteredGrouped = {};
        matches.forEach((activity) => {
          const category = getActivityCategory(activity.categoryId);
          if (!category) return;
          if (!filteredGrouped[category.id]) {
            filteredGrouped[category.id] = { category, activities: [] };
          }
          filteredGrouped[category.id].activities.push(activity);
        });

        Object.values(filteredGrouped).forEach(({ category, activities }) => {
          if (category.id === 'strength') {
            html += buildCategorySection(category, null, groupActivitiesByMuscleGroup(activities));
          } else {
            html += buildCategorySection(category, activities);
          }
        });
      }
    }

    // Handle empty states
    if (html === '') {
      if (query.trim() === '') {
        html = `
          <div class="flex flex-col items-center justify-center py-8 text-center space-y-2">
            <span class="material-icons text-4xl text-gray-400">fitness_center</span>
            <p class="text-gray-600 dark:text-gray-400">No activities available</p>
            <p class="text-sm text-gray-500">Tap "New" to create your first activity</p>
          </div>
        `;
      } else {
        html = `
          <div class="flex flex-col items-center justify-center py-8 text-center space-y-2">
            <span class="material-icons text-4xl text-gray-400">search_off</span>
            <p class="text-gray-600 dark:text-gray-400">No activities found</p>
            <p class="text-sm text-gray-500">Try a different search term or create a new activity</p>
          </div>
        `;
      }
    }

    content.innerHTML = html;
    this._bindContentEvents(content);
  },

  /**
   * Binds handlers to freshly rendered list content.
   * @param {HTMLElement} content - The rendered list container
   * @returns {void}
   */
  _bindContentEvents(content) {
    bindCategorySectionEvents(
      content,
      (button) => this._handleCategoryColorChange(button),
      (categoryId, expanded) => {
        if (expanded) this._expanded.add(categoryId);
        else this._expanded.delete(categoryId);
      }
    );
    bindActivityTileEvents(content, this._callbacks.onActivityClick);
    bindSearchKeyboardNavigation(content, document.getElementById('activity-library-filter'));
  },

  /**
   * Opens the colour picker for a category and persists the choice.
   * @param {HTMLElement} button - The category edit button
   * @returns {void}
   */
  _handleCategoryColorChange(button) {
    const host = document.getElementById('activity-library-content');
    openCategoryColorPicker(
      button,
      async (categoryId, newColor, buttonElement) => {
        const saved = await dispatch(Actions.updateActivityCategoryColor(categoryId, newColor));
        if (!saved) return;
        updateSearchCategoryButton(buttonElement, newColor);
        // Re-render so header tints and tile borders pick up the new colour, with
        // the modal staying open on the current filter.
        this.refresh();
      },
      host
    );
  },

  /**
   * Binds the handlers that live on markup present for the page's lifetime.
   * Guarded so repeated opens do not stack duplicate listeners.
   * @returns {void}
   */
  _bindStaticHandlers() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal || modal.dataset.listenerAttached) return;

    const filter = document.getElementById('activity-library-filter');
    if (filter) {
      filter.addEventListener('input', (event) => {
        const value = event.target.value;
        this._toggleClearButton(value);
        this._render(value);
      });
      filter.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        if (filter.value) {
          filter.value = '';
          this._toggleClearButton('');
          this._render('');
        } else {
          this.close();
        }
      });
    }

    const clearBtn = document.getElementById('activity-library-filter-clear');
    clearBtn?.addEventListener('click', () => {
      if (!filter) return;
      filter.value = '';
      this._toggleClearButton('');
      this._render('');
      filter.focus();
    });

    document.getElementById('close-activity-library')?.addEventListener('click', () => {
      this.close();
    });

    // The Add Activity modal (z-1002) opens on top; the library stays behind it.
    document.getElementById('library-new-activity-btn')?.addEventListener('click', async () => {
      const { Modals } = await import('../FitnessModals.js');
      Modals.openAddActivity();
    });

    // Click on the overlay itself closes the library.
    modal.addEventListener('click', (event) => {
      if (event.target === modal) this.close();
    });

    // A newly created or deleted activity should show up immediately underneath.
    document.addEventListener('modalClosed', (event) => {
      if (event.detail?.modalId !== 'add-activity-modal') return;
      if (isModalOpen(MODAL_ID)) this.refresh();
    });
    document.addEventListener('ActivityDeleted', () => {
      if (isModalOpen(MODAL_ID)) this.refresh();
    });

    // Escape closes only the topmost modal.
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (topModalId() !== MODAL_ID) return;
      const filterInput = document.getElementById('activity-library-filter');
      if (filterInput?.value) {
        filterInput.value = '';
        this._toggleClearButton('');
        this._render('');
        return;
      }
      this.close();
    });

    modal.dataset.listenerAttached = 'true';
  },
};
