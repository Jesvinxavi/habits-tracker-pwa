// AddMenu.js - Dropdown beside the Activities pill for adding to the selected day
const MENU_ID = 'fitness-add-menu';

let menuEl = null;
let anchorEl = null;
let documentClickHandler = null;
let documentKeyHandler = null;

const ITEMS = [
  { action: 'add-activity', icon: 'fitness_center', label: 'Add activity' },
  { action: 'add-routine', icon: 'repeat', label: 'Add routine' },
  { action: 'add-program-day', icon: 'playlist_add', label: 'Add today\u2019s program' },
  { action: 'save-routine', icon: 'bookmark_add', label: 'Save as routine' },
  { action: 'new-program', icon: 'calendar_month', label: 'New program' },
  { action: 'timer', icon: 'schedule', label: 'Timer' },
];

const ITEM_CLASS =
  'dropdown-item flex items-center h-[36px] gap-2 px-4 py-0 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors text-sm font-medium focus:outline-none focus:bg-black/5 dark:focus:bg-white/5';

/**
 * Reports whether the menu is currently open.
 * @returns {boolean} True when the dropdown is visible.
 */
export function isAddMenuOpen() {
  return Boolean(menuEl) && !menuEl.classList.contains('hidden');
}

/**
 * Closes the dropdown and syncs aria-expanded on the anchor.
 * @param {boolean} [restoreFocus] - Whether to return focus to the anchor button
 * @returns {void}
 */
export function closeAddMenu(restoreFocus = false) {
  if (!menuEl) return;
  menuEl.classList.add('hidden');
  anchorEl?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) anchorEl?.focus();
}

/**
 * Toggles the dropdown open or closed.
 * @returns {void}
 */
export function toggleAddMenu() {
  if (!menuEl) return;
  if (isAddMenuOpen()) {
    closeAddMenu();
    return;
  }
  menuEl.classList.remove('hidden');
  anchorEl?.setAttribute('aria-expanded', 'true');
}

/**
 * Removes the menu and its document-level listeners.
 * @returns {void}
 */
export function unmountAddMenu() {
  if (documentClickHandler) {
    document.removeEventListener('click', documentClickHandler);
    documentClickHandler = null;
  }
  if (documentKeyHandler) {
    document.removeEventListener('keydown', documentKeyHandler);
    documentKeyHandler = null;
  }
  menuEl?.remove();
  menuEl = null;
  anchorEl = null;
}

/**
 * Moves focus between menu items, wrapping at both ends.
 * @param {number} delta - +1 for the next item, -1 for the previous
 * @returns {void}
 */
function moveFocus(delta) {
  const items = [...menuEl.querySelectorAll('.dropdown-item')];
  if (items.length === 0) return;
  const current = items.indexOf(document.activeElement);
  const next = (current + delta + items.length) % items.length;
  items[next].focus();
}

/**
 * Builds and mounts the add dropdown as a sibling of its anchor button.
 * @param {HTMLElement} anchorButton - The + pill the menu hangs from
 * @param {Object} actions - Handlers keyed by intent
 * @param {Function} [actions.onAddActivity] - Opens the activity library
 * @param {Function} [actions.onAddRoutine] - Opens the routine picker
 * @param {Function} [actions.onAddProgramDay] - Records the day's scheduled program routines
 * @param {Function} [actions.onSaveAsRoutine] - Saves the day's activities as a routine
 * @param {Function} [actions.onNewProgram] - Opens the program builder
 * @param {Function} [actions.onTimer] - Opens the timer modal
 * @returns {HTMLElement|null} The mounted menu element.
 */
export function mountAddMenu(anchorButton, actions = {}) {
  if (!anchorButton) return null;

  // A fresh mount replaces any previous one so listeners never stack up.
  unmountAddMenu();

  anchorEl = anchorButton;
  menuEl = document.createElement('div');
  menuEl.id = MENU_ID;
  // left-0 keeps the menu inside the viewport at 375px, since the anchor sits
  // near the left edge beside the Activities pill.
  menuEl.className =
    'absolute top-full left-0 mt-2 bg-gray-100 dark:bg-gray-900 rounded-[14px] shadow-lg min-w-max z-50 overflow-hidden hidden p-1';
  menuEl.setAttribute('role', 'menu');
  menuEl.setAttribute('aria-labelledby', anchorButton.id);
  menuEl.innerHTML = ITEMS.map(
    ({ action, icon, label }) => `
      <div class="${ITEM_CLASS}" data-action="${action}" role="menuitem" tabindex="0">
        <span class="material-icons text-[18px]">${icon}</span><span>${label}</span>
      </div>
    `
  ).join('');

  const handlers = {
    'add-activity': actions.onAddActivity,
    'add-routine': actions.onAddRoutine,
    'add-program-day': actions.onAddProgramDay,
    'save-routine': actions.onSaveAsRoutine,
    'new-program': actions.onNewProgram,
    timer: actions.onTimer,
  };

  const activate = (item) => {
    const action = item.dataset.action;
    if (!action) return;
    // Close before invoking so the menu never sits on top of a new modal.
    closeAddMenu();
    handlers[action]?.();
  };

  menuEl.addEventListener('click', (event) => {
    const item = event.target.closest('.dropdown-item');
    if (item) activate(item);
  });

  menuEl.addEventListener('keydown', (event) => {
    const item = event.target.closest('.dropdown-item');
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(-1);
        break;
      case 'Enter':
      case ' ':
        if (!item) return;
        event.preventDefault();
        activate(item);
        break;
      case 'Escape':
        event.preventDefault();
        closeAddMenu(true);
        break;
      default:
        break;
    }
  });

  anchorButton.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleAddMenu();
    if (isAddMenuOpen()) menuEl.querySelector('.dropdown-item')?.focus();
  });

  anchorButton.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    if (!isAddMenuOpen()) toggleAddMenu();
    menuEl.querySelector('.dropdown-item')?.focus();
  });

  documentClickHandler = (event) => {
    if (!menuEl) return;
    if (menuEl.contains(event.target) || anchorEl?.contains(event.target)) return;
    closeAddMenu();
  };
  document.addEventListener('click', documentClickHandler);

  documentKeyHandler = (event) => {
    if (event.key !== 'Escape' || !isAddMenuOpen()) return;
    closeAddMenu(true);
  };
  document.addEventListener('keydown', documentKeyHandler);

  anchorButton.insertAdjacentElement('afterend', menuEl);
  return menuEl;
}
