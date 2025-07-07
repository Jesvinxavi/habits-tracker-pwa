// AddEditActivityModal.js - Add/Edit Activity Modal component
import { openModal, closeModal } from '../../../components/Modal.js';
import { appData } from '../../../core/state.js';
import { addActivity, updateActivity, deleteActivity, getActivity } from '../activities.js';

/**
 * AddEditActivityModal component for managing activity creation and editing
 */
export const AddEditActivityModal = {
  // Form validation function
  _validateForm: null,

  /**
   * Opens the modal in add mode
   */
  openAddMode() {
    // Set up event handlers BEFORE opening the modal
    this._setupEventHandlers();

    // Reset form
    const form = document.getElementById('add-activity-form');
    if (form) form.reset();

    // Hide delete button for add mode
    const delBtn = document.getElementById('delete-activity-btn');
    if (delBtn) delBtn.classList.add('hidden');

    // Reset modal title and save button text
    const modalTitle = document.querySelector('#add-activity-modal h2');
    if (modalTitle) modalTitle.textContent = 'New Activity';

    const saveBtn = document.getElementById('save-add-activity');
    if (saveBtn) saveBtn.textContent = 'Add';

    // Clear edit mode data
    const modal = document.getElementById('add-activity-modal');
    if (modal) {
      delete modal.dataset.editActivityId;
      delete modal.dataset.editMode;
    }

    // Reset icon selection to default running icon
    this._setSelectedActivityIcon('🏃‍♂️');
    let iconDisplay = document.getElementById('activity-selected-icon-display');
    if (iconDisplay) iconDisplay.textContent = this._getSelectedActivityIcon();

    // Reset muscle group section
    const muscleGroupSection = document.getElementById('muscle-group-section');
    const muscleGroupSelect = document.getElementById('muscle-group-select');
    if (muscleGroupSection) muscleGroupSection.classList.add('hidden');
    if (muscleGroupSelect) muscleGroupSelect.value = '';

    // Reset tracking type and units sections
    const unitsSection = document.getElementById('units-section');
    const unitsSelect = document.getElementById('units-select');
    if (unitsSection) unitsSection.classList.add('hidden');
    if (unitsSelect) unitsSelect.value = 'none';

    // Populate category dropdown
    const categorySelect = document.getElementById('activity-category-select');
    if (categorySelect) {
      categorySelect.innerHTML =
        '<option value="" disabled selected>Select a category</option>' +
        appData.activityCategories
          .map((cat) => `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`)
          .join('');
    }

    // Show modal using common modal system
    openModal('add-activity-modal');

    // Setup components after modal is shown (ensure DOM elements exist)
    setTimeout(() => {
      this._setupActivityIconPicker();
      this._initializeTrackingTypeToggles();
      this._setupFormValidation();
    }, 50);

    // Validate form to set Add button state
    if (this._validateForm) this._validateForm();
  },

  /**
   * Opens the modal in edit mode
   * @param {string} activityId - The activity ID to edit
   */
  openEditMode(activityId) {
    const activity = getActivity(activityId);
    if (!activity) {
      console.error('Activity not found:', activityId);
      return;
    }

    // Reset form first
    const form = document.getElementById('add-activity-form');
    if (form) form.reset();

    // Populate form with activity data
    const nameInput = document.getElementById('activity-name-input');
    const categorySelect = document.getElementById('activity-category-select');
    const muscleGroupSelect = document.getElementById('muscle-group-select');
    const muscleGroupSection = document.getElementById('muscle-group-section');

    if (nameInput) nameInput.value = activity.name;

    // Populate category dropdown and select current category
    if (categorySelect) {
      categorySelect.innerHTML =
        '<option value="" disabled>Select a category</option>' +
        appData.activityCategories
          .map(
            (cat) =>
              `<option value="${cat.id}" ${cat.id === activity.categoryId ? 'selected' : ''}>${cat.icon} ${cat.name}</option>`
          )
          .join('');
    }

    // Handle muscle group for strength training
    if (activity.categoryId === 'strength' && activity.muscleGroup) {
      if (muscleGroupSection) muscleGroupSection.classList.remove('hidden');
      if (muscleGroupSelect) muscleGroupSelect.value = activity.muscleGroup;
    } else {
      if (muscleGroupSection) muscleGroupSection.classList.add('hidden');
    }

    // Set icon
    this._setSelectedActivityIcon(activity.icon || '🏃‍♂️');
    const iconDisplay = document.getElementById('activity-selected-icon-display');
    if (iconDisplay) iconDisplay.textContent = this._getSelectedActivityIcon();

    // Set tracking type and units
    const trackingType = activity.trackingType || 'time';
    this._setSelectedTrackingType(trackingType);

    // Handle units for sets-reps tracking
    if (trackingType === 'sets-reps') {
      const unitsSection = document.getElementById('units-section');
      const unitsSelect = document.getElementById('units-select');
      if (unitsSection) unitsSection.classList.remove('hidden');
      if (unitsSelect) unitsSelect.value = activity.units || 'none';
    } else {
      const unitsSection = document.getElementById('units-section');
      const unitsSelect = document.getElementById('units-select');
      if (unitsSection) unitsSection.classList.add('hidden');
      if (unitsSelect) unitsSelect.value = 'none';
    }

    // Show delete button for edit mode
    const delBtn = document.getElementById('delete-activity-btn');
    if (delBtn) {
      delBtn.classList.remove('hidden');
      // Set up delete button handler
      if (!delBtn.dataset.listenerAttached) {
        delBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this._handleDeleteActivity(activityId);
        });
        delBtn.dataset.listenerAttached = 'true';
      }
    }

    // Reset modal title and save button text
    const modalTitle = document.querySelector('#add-activity-modal h2');
    if (modalTitle) modalTitle.textContent = 'Edit Activity';

    const saveBtn = document.getElementById('save-add-activity');
    if (saveBtn) saveBtn.textContent = 'Update';

    // Store edit mode data
    const modal = document.getElementById('add-activity-modal');
    if (modal) {
      modal.dataset.editActivityId = activityId;
      modal.dataset.editMode = 'true';
    }

    // Show modal using common modal system
    openModal('add-activity-modal');

    // Setup components after modal is shown (ensure DOM elements exist)
    setTimeout(() => {
      this._setupEventHandlers();
      this._setupActivityIconPicker();
      this._initializeTrackingTypeToggles();
      this._setupFormValidation();
    }, 50);

    // Validate form to set Update button state
    if (this._validateForm) this._validateForm();
  },

  /**
   * Sets up the modal event handlers
   */
  _setupEventHandlers() {
    // Cancel button
    const cancelAddBtn = document.getElementById('cancel-add-activity');
    if (cancelAddBtn && !cancelAddBtn.dataset.listenerAttached) {
      cancelAddBtn.addEventListener('click', () => {
        closeModal('add-activity-modal');
      });
      cancelAddBtn.dataset.listenerAttached = 'true';
    }

    // Setup icon picker
    this._setupActivityIconPicker();

    // Setup form validation
    this._setupFormValidation();
  },

  /**
   * Sets up the activity icon picker
   */
  _setupActivityIconPicker() {
    const iconSelectorBtn = document.getElementById('activity-icon-selector-btn');
    const iconModal = document.getElementById('icon-selection-modal');
    let iconDisplay = document.getElementById('activity-selected-icon-display');

    if (!iconSelectorBtn || !iconModal || !iconDisplay) {
      return;
    }

    // Remove any existing listeners to avoid duplicates
    const newIconSelectorBtn = iconSelectorBtn.cloneNode(true);
    iconSelectorBtn.parentNode.replaceChild(newIconSelectorBtn, iconSelectorBtn);

    // Re-query the icon display inside the newly cloned button to ensure we reference the live element
    const updatedIconDisplay =
      newIconSelectorBtn.querySelector('#activity-selected-icon-display') ||
      document.getElementById('activity-selected-icon-display');

    // Replace the old reference
    iconDisplay = updatedIconDisplay;

    newIconSelectorBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Build the icon grid before opening the modal (ensures content is ready)
      this._buildActivityIconGrid(iconModal);

      // Use the shared modal helper so all animation/display logic is consistent
      openModal('icon-selection-modal');
    });

    // Close when clicking outside content
    iconModal.addEventListener('click', (e) => {
      if (e.target === iconModal) {
        closeModal('icon-selection-modal');
      }
    });

    const selectIconBtn = document.getElementById('select-icon');
    const cancelIconBtn = document.getElementById('cancel-icon');

    const clearIconHighlights = () => {
      iconModal
        .querySelectorAll('.icon-option')
        .forEach((btn) => btn.classList.remove('ring', 'ring-ios-blue', 'ring-2'));
    };

    iconModal.addEventListener('click', (e) => {
      const opt = e.target.closest('.icon-option');
      if (!opt) return;
      const chosen = opt.dataset.icon || '🏃‍♂️';
      this._setSelectedActivityIcon(chosen);
      iconDisplay.textContent = chosen; // Update immediately for instant feedback
      clearIconHighlights();
      opt.classList.add('ring', 'ring-ios-blue', 'ring-2');
      if (selectIconBtn) selectIconBtn.disabled = false;
    });

    if (selectIconBtn) {
      selectIconBtn.addEventListener('click', () => {
        iconDisplay.textContent = this._getSelectedActivityIcon();
        closeModal('icon-selection-modal');
      });
    }

    if (cancelIconBtn) {
      cancelIconBtn.addEventListener('click', () => {
        closeModal('icon-selection-modal');
      });
    }
  },

  /**
   * Sets up form validation
   */
  _setupFormValidation() {
    const form = document.getElementById('add-activity-form');
    const nameInput = document.getElementById('activity-name-input');
    const categorySelect = document.getElementById('activity-category-select');
    const addBtn = document.getElementById('save-add-activity');

    this._validateForm = () => {
      const nameValid = nameInput && nameInput.value.trim().length > 0;
      const categoryValid = categorySelect && categorySelect.value;

      // Check if muscle group is required and valid
      const isStrengthTraining = categorySelect && categorySelect.value === 'strength';
      const muscleGroupSelect = document.getElementById('muscle-group-select');
      const muscleGroupValid =
        !isStrengthTraining || (muscleGroupSelect && muscleGroupSelect.value);

      const allValid = nameValid && categoryValid && muscleGroupValid;
      if (addBtn) {
        addBtn.disabled = !allValid;
        addBtn.classList.toggle('opacity-50', addBtn.disabled);
      }
    };

    if (nameInput) nameInput.addEventListener('input', this._validateForm);
    if (categorySelect) {
      categorySelect.addEventListener('change', this._validateForm);
      categorySelect.addEventListener('change', () => this._updateActivityIconFromCategory());
      categorySelect.addEventListener('change', () => this._initializeTrackingTypeToggles());
      categorySelect.addEventListener('change', () => this._handleMuscleGroupVisibility());
    }

    // Add muscle group validation
    const muscleGroupSelect = document.getElementById('muscle-group-select');
    if (muscleGroupSelect) {
      muscleGroupSelect.addEventListener('change', this._validateForm);
    }

    // Add click handler for the save button (since it's outside the form)
    if (addBtn && !addBtn.dataset.listenerAttached) {
      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this._handleFormSubmit();
      });
      addBtn.dataset.listenerAttached = 'true';
    }

    // Add activity on submit (backup for form submission)
    if (form && !form.dataset.listenerAttached) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this._handleFormSubmit();
      });
      form.dataset.listenerAttached = 'true';
    }
  },

  /**
   * Handles form submission
   */
  _handleFormSubmit() {
    const nameInput = document.getElementById('activity-name-input');
    const categorySelect = document.getElementById('activity-category-select');
    const muscleGroupSelect = document.getElementById('muscle-group-select');

    if (!nameInput || !categorySelect) return;

    const name = nameInput.value.trim();
    const categoryId = categorySelect.value;
    const icon = this._getSelectedActivityIcon();

    // Get muscle group if strength training
    const muscleGroup =
      categoryId === 'strength' && muscleGroupSelect ? muscleGroupSelect.value : null;

    // Get tracking type and units
    const trackingType = this._getSelectedTrackingType();
    const units =
      trackingType === 'sets-reps'
        ? document.getElementById('units-select')?.value || 'none'
        : null;

    // Create activity object
    const activity = {
      name,
      categoryId,
      icon,
      muscleGroup,
      trackingType,
      units,
    };

    // Check if editing or adding
    const modal = document.getElementById('add-activity-modal');
    const editActivityId = modal?.dataset.editActivityId;

    if (editActivityId) {
      // Edit existing activity
      updateActivity(editActivityId, activity);
    } else {
      // Add new activity
      addActivity(activity);
    }

    closeModal('add-activity-modal');
  },

  // Helper methods for icon and tracking type management
  _selectedActivityIcon: '🏃‍♂️',
  _selectedTrackingType: 'time',

  _getSelectedActivityIcon() {
    return this._selectedActivityIcon;
  },

  _setSelectedActivityIcon(icon) {
    this._selectedActivityIcon = icon;
  },

  _getSelectedTrackingType() {
    return this._selectedTrackingType;
  },

  _setSelectedTrackingType(type) {
    this._selectedTrackingType = type;
  },

  // Placeholder methods that would need full implementation
  _buildActivityIconGrid(modal) {
    // This would contain the icon grid building logic
    // TODO: Implement icon grid building logic
  },

  _updateActivityIconFromCategory() {
    // This would update the icon based on selected category
    // TODO: Implement icon update logic
  },

  _initializeTrackingTypeToggles() {
    const setsRepsToggle = document.getElementById('sets-reps-toggle');
    const timeToggle = document.getElementById('time-toggle');
    const categorySelect = document.getElementById('activity-category-select');
    const unitsSection = document.getElementById('units-section');

    if (!setsRepsToggle || !timeToggle) return;

    // Function to update toggle states
    const updateToggleStates = () => {
      const selectedCategory = categorySelect?.value;
      const currentTrackingType = this._getSelectedTrackingType();

      // Sports category should always be time-based and not toggleable
      if (selectedCategory === 'sports') {
        this._setSelectedTrackingType('time');
        setsRepsToggle.disabled = true;
        timeToggle.disabled = true;
        setsRepsToggle.classList.add('opacity-50', 'cursor-not-allowed');
        timeToggle.classList.add('opacity-50', 'cursor-not-allowed');
      } else {
        setsRepsToggle.disabled = false;
        timeToggle.disabled = false;
        setsRepsToggle.classList.remove('opacity-50', 'cursor-not-allowed');
        timeToggle.classList.remove('opacity-50', 'cursor-not-allowed');
      }

      // Update visual states based on current tracking type
      if (currentTrackingType === 'sets-reps') {
        setsRepsToggle.classList.add(
          'bg-white',
          'dark:bg-gray-700',
          'text-gray-900',
          'dark:text-white',
          'border',
          'border-gray-200',
          'dark:border-gray-600',
          'shadow-sm'
        );
        setsRepsToggle.classList.remove('text-gray-600', 'dark:text-gray-400');
        timeToggle.classList.remove(
          'bg-white',
          'dark:bg-gray-700',
          'text-gray-900',
          'dark:text-white',
          'border',
          'border-gray-200',
          'dark:border-gray-600',
          'shadow-sm'
        );
        timeToggle.classList.add('text-gray-600', 'dark:text-gray-400');

        // Show units section for sets-reps
        if (unitsSection) unitsSection.classList.remove('hidden');
      } else {
        timeToggle.classList.add(
          'bg-white',
          'dark:bg-gray-700',
          'text-gray-900',
          'dark:text-white',
          'border',
          'border-gray-200',
          'dark:border-gray-600',
          'shadow-sm'
        );
        timeToggle.classList.remove('text-gray-600', 'dark:text-gray-400');
        setsRepsToggle.classList.remove(
          'bg-white',
          'dark:bg-gray-700',
          'text-gray-900',
          'dark:text-white',
          'border',
          'border-gray-200',
          'dark:border-gray-600',
          'shadow-sm'
        );
        setsRepsToggle.classList.add('text-gray-600', 'dark:text-gray-400');

        // Hide units section for time-based
        if (unitsSection) unitsSection.classList.add('hidden');
      }
    };

    // Add click handlers for toggle buttons
    if (!setsRepsToggle.dataset.listenerAttached) {
      setsRepsToggle.addEventListener('click', () => {
        const selectedCategory = categorySelect?.value;
        if (selectedCategory === 'sports') return; // Sports should not toggle

        this._setSelectedTrackingType('sets-reps');
        updateToggleStates();
      });
      setsRepsToggle.dataset.listenerAttached = 'true';
    }

    if (!timeToggle.dataset.listenerAttached) {
      timeToggle.addEventListener('click', () => {
        const selectedCategory = categorySelect?.value;
        if (selectedCategory === 'sports') return; // Sports should not toggle

        this._setSelectedTrackingType('time');
        updateToggleStates();
      });
      timeToggle.dataset.listenerAttached = 'true';
    }

    // Add category change handler to update toggle states
    if (categorySelect && !categorySelect.dataset.toggleListenerAttached) {
      categorySelect.addEventListener('change', updateToggleStates);
      categorySelect.dataset.toggleListenerAttached = 'true';
    }

    // Initialize toggle states
    updateToggleStates();
  },

  _handleDeleteActivity(activityId) {
    if (confirm('Are you sure you want to delete this activity? This action cannot be undone.')) {
      deleteActivity(activityId);
      closeModal('add-activity-modal');

      // Trigger refresh of search panel to reflect the deletion
      const event = new CustomEvent('ActivityDeleted', {
        detail: { activityId },
      });
      document.dispatchEvent(event);
    }
  },

  _handleMuscleGroupVisibility() {
    const categorySelect = document.getElementById('activity-category-select');
    const muscleGroupSection = document.getElementById('muscle-group-section');
    const muscleGroupSelect = document.getElementById('muscle-group-select');

    if (!categorySelect || !muscleGroupSection) return;

    const selectedCategory = categorySelect.value;

    if (selectedCategory === 'strength') {
      // Show muscle group section for strength training
      muscleGroupSection.classList.remove('hidden');
      if (muscleGroupSelect) {
        muscleGroupSelect.required = true;
      }
    } else {
      // Hide muscle group section for other categories
      muscleGroupSection.classList.add('hidden');
      if (muscleGroupSelect) {
        muscleGroupSelect.required = false;
        muscleGroupSelect.value = '';
      }
    }
  },
};
