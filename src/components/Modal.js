// Tracks which modals are open, innermost last. Stacked modals (Activity Library
// → Add Activity → Icon Picker) must not release the body scroll-lock until the
// last one closes, or the page scrolls behind a modal that is still open.
const openStack = [];
const focusOrigins = new Map();
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableElements(modal) {
  return [...modal.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
    (element) => !element.closest('[hidden]') && element.getAttribute('aria-hidden') !== 'true'
  );
}

function focusModal(modal) {
  const [first] = focusableElements(modal);
  if (first) {
    first.focus({ preventScroll: true });
    return;
  }
  modal.tabIndex = -1;
  modal.focus({ preventScroll: true });
}

function trapTopModalFocus(event) {
  if (event.key !== 'Tab') return;
  const id = topModalId();
  if (!id) return;
  const modal = document.getElementById(id);
  if (!modal) return;
  const focusable = focusableElements(modal);
  if (focusable.length === 0) {
    event.preventDefault();
    focusModal(modal);
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (
    !event.shiftKey &&
    (document.activeElement === last || !modal.contains(document.activeElement))
  ) {
    event.preventDefault();
    first.focus();
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', trapTopModalFocus);
}

/**
 * Opens a modal by id and locks body scrolling.
 * @param {string} id Modal element id.
 * @returns {void}
 */
export function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  if (!openStack.includes(id)) {
    const origin = document.activeElement;
    if (origin instanceof HTMLElement) focusOrigins.set(id, origin);
    const currentTop = document.getElementById(topModalId());
    currentTop?.setAttribute('aria-hidden', 'true');
    openStack.push(id);
  }
  document.body.style.overflow = 'hidden';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.removeAttribute('aria-hidden');
  const heading = modal.querySelector('h1, h2, [data-modal-title]');
  if (heading) {
    if (!heading.id) heading.id = `${id}-title`;
    modal.setAttribute('aria-labelledby', heading.id);
  }
  modal.classList.remove('hidden');
  modal.classList.remove('animate-in', 'fade-in');
  // Guarantee element becomes visible even if other styles override Tailwind
  modal.style.display = 'flex';

  // Reset scroll position to top when opening
  const scrollable = modal.querySelector('.overflow-y-auto');
  if (scrollable) scrollable.scrollTop = 0;

  focusModal(modal);
}

/**
 * Closes a modal by id, restoring body scrolling only once the last open modal closes.
 * @param {string} id Modal element id.
 * @returns {void}
 */
export function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  const index = openStack.lastIndexOf(id);
  if (index !== -1) openStack.splice(index, 1);
  modal.classList.add('hidden');
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  if (openStack.length === 0) document.body.style.overflow = '';

  const newTop = document.getElementById(topModalId());
  newTop?.removeAttribute('aria-hidden');
  const origin = focusOrigins.get(id);
  focusOrigins.delete(id);
  if (origin?.isConnected) origin.focus({ preventScroll: true });
  else if (newTop) focusModal(newTop);

}

/**
 * Reports whether a modal is currently open.
 * @param {string} id Modal element id.
 * @returns {boolean} True when the modal is on the open stack.
 */
export function isModalOpen(id) {
  return openStack.includes(id);
}

/**
 * Returns the id of the topmost open modal. Escape handlers use this so a key
 * press only closes the modal the user is actually looking at.
 * @returns {string|undefined} The innermost open modal id, or undefined when none is open.
 */
export function topModalId() {
  return openStack[openStack.length - 1];
}
