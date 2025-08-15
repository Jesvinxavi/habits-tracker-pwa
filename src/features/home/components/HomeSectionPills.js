import { getCategorizedHabitsForSelectedContext } from '../helpers/habitCategorization.js';
import { sectionVisibility } from '../helpers/coreHelpers.js';

export const HomeSectionPills = {
  mount(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.selectedSection = 'Anytime';
    this._ensureStructure();
    this.render();
  },

  _ensureStructure() {
    if (!this.container) return;
    // Ensure a local wrapper element exists for the pills row
    let wrapper = this.container.querySelector('.section-pills-row');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'section-pills-row flex items-center gap-2 overflow-x-auto scrollbar-hide px-2 py-2';
      this.container.appendChild(wrapper);
    }
    this.wrapper = wrapper;

    // Keyboard navigation
    this.wrapper.addEventListener('keydown', (e) => {
      const pills = Array.from(this.wrapper.querySelectorAll('.section-pill-btn'));
      if (!pills.length) return;
      const currentIndex = pills.findIndex((el) => el.classList.contains('selected'));
      if (e.key === 'ArrowRight') {
        const next = pills[(currentIndex + 1) % pills.length];
        next?.focus();
        next?.click();
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        const prev = pills[(currentIndex - 1 + pills.length) % pills.length];
        prev?.focus();
        prev?.click();
        e.preventDefault();
      }
    });
    this.wrapper.setAttribute('tabindex', '0');
    this.wrapper.setAttribute('role', 'tablist');
  },

  getSelectedSection() {
    return this.selectedSection || 'Anytime';
  },

  setSelectedSection(section, opts = {}) {
    const { silent = false } = opts;
    const valid = ['Anytime', 'Scheduled', 'Completed', 'Skipped'];
    if (!valid.includes(section)) return;
    if (this.selectedSection === section) {
      // Still re-render to refresh counts/states if needed
      this.render();
      return;
    }
    this.selectedSection = section;
    this.render();
    if (!silent) this.callbacks.onSectionChange?.(section);
  },

  _ensureValidSelection(counts) {
    const current = this.getSelectedSection();
    const hasItems = (key) => (counts?.[key] || 0) > 0;

    // Invalidate if hidden by visibility
    if (current === 'Completed' && !sectionVisibility.Completed) return this._pickFallback(counts);
    if (current === 'Skipped' && !sectionVisibility.Skipped) return this._pickFallback(counts);

    // Invalidate if zero count
    if (!hasItems(current)) return this._pickFallback(counts);
  },

  _pickFallback(counts) {
    const hasItems = (key) => (counts?.[key] || 0) > 0;
    const order = ['Anytime', 'Scheduled', 'Completed', 'Skipped'];
    for (const key of order) {
      if (key === 'Completed' && !sectionVisibility.Completed) continue;
      if (key === 'Skipped' && !sectionVisibility.Skipped) continue;
      if (hasItems(key)) {
        this.selectedSection = key;
        return;
      }
    }
    // If absolutely nothing, default to Anytime (container may hide itself)
    this.selectedSection = 'Anytime';
  },

  render() {
    if (!this.wrapper) return;

    const { counts } = getCategorizedHabitsForSelectedContext();

    const prevSelection = this.getSelectedSection();
    // Validate selection against current visibility settings and counts
    this._ensureValidSelection(counts);
    const selectionChanged = this.getSelectedSection() !== prevSelection;

    // Build pills row fresh
    this.wrapper.innerHTML = '';

    const pills = [
      { key: 'Anytime', variant: '' },
      { key: 'Scheduled', variant: '' },
      { key: 'Completed', variant: 'section-pill-btn--completed' },
      { key: 'Skipped', variant: 'section-pill-btn--skipped' },
    ];

    const isHiddenByVisibility = (key) => {
      if (key === 'Completed') return !sectionVisibility.Completed;
      if (key === 'Skipped') return !sectionVisibility.Skipped;
      return false;
    };

    const visiblePills = pills.filter((p) => (counts[p.key] || 0) > 0 && !isHiddenByVisibility(p.key));

    // Hide the entire pills container if no sections have any items
    this.container.style.display = visiblePills.length === 0 ? 'none' : '';

    visiblePills.forEach((pill) => {
      const btn = document.createElement('button');
      const isSelected = this.getSelectedSection() === pill.key;
      btn.className = `section-pill-btn ${pill.variant} ${isSelected ? 'selected' : ''}`.trim();
      btn.setAttribute('type', 'button');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      btn.dataset.section = pill.key;
      btn.tabIndex = 0;

      const countDot = document.createElement('span');
      countDot.className = 'section-pill-count';
      countDot.textContent = String(counts[pill.key] || 0);

      const label = document.createElement('span');
      label.textContent = pill.key;

      btn.appendChild(countDot);
      btn.appendChild(label);

      btn.addEventListener('click', () => {
        this.setSelectedSection(pill.key); // not silent: this is a user action
      });

      this.wrapper.appendChild(btn);
    });

    // If selection changed due to counts/visibility, notify list to update immediately
    if (selectionChanged) {
      this.callbacks.onSectionChange?.(this.getSelectedSection());
    }

    // Ensure the selected pill is fully visible
    const selectedEl = this.wrapper.querySelector('.section-pill-btn.selected');
    if (selectedEl && typeof selectedEl.scrollIntoView === 'function') {
      selectedEl.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  },
}; 