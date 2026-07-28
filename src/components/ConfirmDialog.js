// Generic confirmation dialog built on top of Modal.js
// Usage: showConfirm({ title, message, okText?, cancelText?, onOK })
//        showChoice({ title, message, actions, cancelText? }) for more than one way forward

import { openModal, closeModal } from './Modal.js';

const MODAL_ID = 'global-confirm-modal';

/**
 * Returns the shared dialog element, creating it on first use.
 * @returns {HTMLElement} The dialog overlay.
 */
function dialogElement() {
  let modal = document.getElementById(MODAL_ID);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className =
      'modal-overlay fixed inset-0 bg-black/70 backdrop-blur-sm z-[1100] hidden items-center justify-center p-4';
    document.body.appendChild(modal);
  }
  return modal;
}

export function showConfirm({
  title = 'Are you sure?',
  message = '',
  okText = 'OK',
  cancelText = 'Cancel',
  onOK,
} = {}) {
  const modal = dialogElement();

  // Build / replace inner content every time we show the dialog.
  const single = !cancelText;
  modal.innerHTML = `<div class="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">${title}</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">${message}</p>
      <div class="flex ${single ? 'justify-center' : 'gap-3'}">
        ${single ? '' : `<button class='confirm-cancel-btn flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'>${cancelText}</button>`}
        <button class='confirm-ok-btn ${single ? 'w-full' : 'flex-1'} py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors'>${okText}</button>
      </div>
    </div>`;

  // Attach handlers (delegated inside the modal).
  modal.querySelector('.confirm-ok-btn').onclick = () => {
    closeModal('global-confirm-modal');
    if (typeof onOK === 'function') onOK();
  };

  const cancelBtn = modal.querySelector('.confirm-cancel-btn');
  if (cancelBtn) cancelBtn.onclick = () => closeModal(MODAL_ID);

  // Show the modal via the central helper.
  openModal(MODAL_ID);
}

/**
 * Shows a dialog offering more than one way forward, in the same shell as
 * showConfirm. Buttons stack full width, because the labels are sentences
 * rather than the one-word OK/Cancel pair.
 * @param {Object} options - Dialog options
 * @param {string} options.title - Heading
 * @param {string} options.message - Body copy
 * @param {Array<{label: string, onSelect: Function, destructive?: boolean}>} options.actions
 *   Ways forward, in display order. `destructive` paints the button red.
 * @param {string} [options.cancelLabel] - Accessible name for the dismiss control
 * @returns {void}
 */
export function showChoice({ title = '', message = '', actions = [], cancelLabel = 'Cancel' } = {}) {
  const modal = dialogElement();

  // Dismissal is a corner X rather than a third button, matching the activity
  // statistics modal: with two real choices already stacked, a "Cancel" button
  // reads as a third option rather than a way out.
  modal.innerHTML = `<div class="modal-content relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
      <button class='choice-cancel-btn absolute top-3 right-3 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors' aria-label='${cancelLabel}'>
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2 px-6">${title}</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">${message}</p>
      <div class="flex flex-col gap-2">
        ${actions
          .map(
            (action, index) =>
              `<button class='choice-btn w-full py-2 rounded-lg transition-colors ${
                action.destructive
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }' data-index='${index}'>${action.label}</button>`
          )
          .join('')}
      </div>
    </div>`;

  modal.querySelectorAll('.choice-btn').forEach((btn) => {
    btn.onclick = () => {
      closeModal(MODAL_ID);
      actions[Number(btn.dataset.index)]?.onSelect?.();
    };
  });
  modal.querySelector('.choice-cancel-btn').onclick = () => closeModal(MODAL_ID);

  openModal(MODAL_ID);
}
