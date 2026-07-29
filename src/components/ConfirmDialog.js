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

  // Build a static shell, then insert caller-provided copy as text. Confirmation
  // messages sometimes include names supplied by the user, so interpolating them
  // into innerHTML would turn ordinary names into executable markup.
  const single = !cancelText;
  modal.innerHTML = `<div class="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
      <h2 class="confirm-title text-lg font-semibold text-gray-900 dark:text-white mb-2"></h2>
      <p class="confirm-message text-sm text-gray-600 dark:text-gray-400 mb-6"></p>
      <div class="confirm-actions flex ${single ? 'justify-center' : 'gap-3'}">
      </div>
    </div>`;
  modal.querySelector('.confirm-title').textContent = title;
  modal.querySelector('.confirm-message').textContent = message;

  const actions = modal.querySelector('.confirm-actions');
  if (!single) {
    const cancel = document.createElement('button');
    cancel.className =
      'confirm-cancel-btn flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors';
    cancel.textContent = cancelText;
    actions.appendChild(cancel);
  }
  const ok = document.createElement('button');
  ok.className = `confirm-ok-btn ${single ? 'w-full' : 'flex-1'} py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors`;
  ok.textContent = okText;
  actions.appendChild(ok);

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
      <button class='choice-cancel-btn absolute top-3 right-3 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'>
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      <h2 class="choice-title text-lg font-semibold text-gray-900 dark:text-white mb-2 px-6"></h2>
      <p class="choice-message text-sm text-gray-600 dark:text-gray-400 mb-6"></p>
      <div class="choice-actions flex flex-col gap-2"></div>
    </div>`;

  modal.querySelector('.choice-cancel-btn').setAttribute('aria-label', cancelLabel);
  modal.querySelector('.choice-title').textContent = title;
  modal.querySelector('.choice-message').textContent = message;
  const actionHost = modal.querySelector('.choice-actions');
  actions.forEach((action, index) => {
    const button = document.createElement('button');
    button.className = `choice-btn w-full py-2 rounded-lg transition-colors ${
      action.destructive
        ? 'bg-red-600 text-white hover:bg-red-700'
        : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`;
    button.dataset.index = String(index);
    button.textContent = action.label;
    actionHost.appendChild(button);
  });

  modal.querySelectorAll('.choice-btn').forEach((btn) => {
    btn.onclick = () => {
      closeModal(MODAL_ID);
      actions[Number(btn.dataset.index)]?.onSelect?.();
    };
  });
  modal.querySelector('.choice-cancel-btn').onclick = () => closeModal(MODAL_ID);

  openModal(MODAL_ID);
}
