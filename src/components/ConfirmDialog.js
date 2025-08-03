// Generic confirmation dialog built on top of Modal.js
// Usage: showConfirm({ title, message, okText?, cancelText?, onOK })

import { openModal, closeModal } from './Modal.js';

export function showConfirm({
  title = 'Are you sure?',
  message = '',
  okText = 'OK',
  cancelText = 'Cancel',
  onOK,
} = {}) {
  // Ensure a single reusable modal element exists.
  let modal = document.getElementById('global-confirm-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'global-confirm-modal';
    modal.className =
      'modal-overlay fixed inset-0 bg-black/70 backdrop-blur-sm z-[1100] hidden items-center justify-center p-4';
    document.body.appendChild(modal);
  }

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
  if (cancelBtn) cancelBtn.onclick = () => closeModal('global-confirm-modal');

  // Show the modal via the central helper.
  openModal('global-confirm-modal');
}
