// Tracks which modals are open, innermost last. Stacked modals (Activity Library
// → Add Activity → Icon Picker) must not release the body scroll-lock until the
// last one closes, or the page scrolls behind a modal that is still open.
const openStack = [];

/**
 * Opens a modal by id and locks body scrolling.
 * @param {string} id Modal element id.
 * @returns {void}
 */
export function openModal(id) {
  const all = document.querySelectorAll(`#${id}`);
  const modal = all[all.length - 1];
  if (!modal) return;
  if (!openStack.includes(id)) openStack.push(id);
  document.body.style.overflow = 'hidden';
  modal.classList.remove('hidden');
  modal.classList.remove('animate-in', 'fade-in');
  // Guarantee element becomes visible even if other styles override Tailwind
  modal.style.display = 'flex';

  // Reset scroll position to top when opening
  const scrollable = modal.querySelector('.overflow-y-auto');
  if (scrollable) scrollable.scrollTop = 0;

  // Ensure modal is appended directly to <body>
  if (modal.parentNode !== document.body) {
    document.body.appendChild(modal);
  }
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
  if (openStack.length === 0) document.body.style.overflow = '';

  // Dispatch custom event to notify that a modal was closed
  const event = new CustomEvent('modalClosed', {
    detail: { modalId: id },
  });
  document.dispatchEvent(event);
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
