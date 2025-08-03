/**
 * UI controller for Manage Holiday Periods modal.
 * Relies on utils/holidays.js for data mutations.
 */

import { getState } from '../../core/state.js';
import { addPeriod, deletePeriod, updatePeriod, deleteAllPeriods } from './holidays.js';
import { openModal, closeModal } from '../../components/Modal.js';
import { showConfirm } from '../../components/ConfirmDialog.js';
import { formatDate } from '../../shared/datetime.js';

let hasInitialised = false;
let periodFormInit = false;
let editingPeriodId = null;

export function openHolidayModal() {
  if (!hasInitialised) initModal();
  refreshPeriodList();
  openModal('holiday-modal');
}

function initModal() {
  const modal = document.getElementById('holiday-modal');
  if (!modal) return;

  // Header buttons
  modal
    .querySelector('#cancel-holiday')
    ?.addEventListener('click', () => closeModal('holiday-modal'));
  modal
    .querySelector('#done-holiday')
    ?.addEventListener('click', () => closeModal('holiday-modal'));

  // ensure form modal ready
  initPeriodFormModal();

  // Add period button opens form
  modal.querySelector('#add-period-btn')?.addEventListener('click', () => {
    openPeriodForm({ mode: 'add' });
  });

  // Delete all periods
  modal.querySelector('#delete-all-periods')?.addEventListener('click', () => {
    showConfirm({
      title: 'Delete All Holiday Periods',
      message: 'This will remove every holiday period you have added. Continue?',
      okText: 'Delete All',
      cancelText: 'Cancel',
      onOK: () => {
        deleteAllPeriods();
        refreshPeriodList();
      },
    });
  });

  hasInitialised = true;
}

function initPeriodFormModal() {
  if (periodFormInit) return;
  periodFormInit = true;
  const modalId = 'holiday-period-modal';
  const modalEl = document.getElementById(modalId);
  if (!modalEl) return;

  const labelInput = modalEl.querySelector('#period-label-input');
  const startInput = modalEl.querySelector('#period-start-input');
  const endInput = modalEl.querySelector('#period-end-input');
  const saveBtn = modalEl.querySelector('#save-period');
  const cancelBtn = modalEl.querySelector('#cancel-period');
  const titleEl = modalEl.querySelector('#period-form-title');

  function validate() {
    const ok =
      labelInput.value.trim() !== '' &&
      startInput.value &&
      endInput.value &&
      endInput.value >= startInput.value;
    saveBtn.disabled = !ok;
    saveBtn.classList.toggle('opacity-50', !ok);
  }

  [labelInput, startInput, endInput].forEach((el) => el.addEventListener('input', validate));

  cancelBtn.addEventListener('click', () => closeModal(modalId));

  saveBtn.addEventListener('click', () => {
    if (saveBtn.disabled) return;
    if (editingPeriodId) {
      // update existing
      updatePeriod({
        id: editingPeriodId,
        label: labelInput.value.trim(),
        startISO: startInput.value,
        endISO: endInput.value,
      });
    } else {
      addPeriod({
        label: labelInput.value.trim(),
        startISO: startInput.value,
        endISO: endInput.value,
      });
    }
    closeModal(modalId);
    refreshPeriodList();
  });

  // expose helper to populate & open
  openPeriodForm = function ({ mode, period }) {
    editingPeriodId = mode === 'edit' ? period.id : null;
    titleEl.textContent = mode === 'edit' ? 'Edit Holiday Period' : 'New Holiday Period';
    labelInput.value = period?.label || '';
    const today = new Date().toISOString().slice(0, 10);
    startInput.value = period?.startISO || today;
    endInput.value = period?.endISO || today;
    validate();
    openModal(modalId);
  };
}

let openPeriodForm = () => {};

function refreshPeriodList() {
  const wrap = document.getElementById('period-list');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (getState().holidayPeriods.length === 0) {
    wrap.insertAdjacentHTML(
      'beforeend',
      '<p class="text-center text-gray-500 dark:text-gray-400 text-sm">No holiday periods yet.</p>'
    );
    return;
  }

  getState().holidayPeriods.forEach((p) => {
    const row = document.createElement('div');
    row.className =
      'flex justify-between items-center p-3 bg-white/80 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-lg';

    // Calc days difference (inclusive)
    const days = Math.round((new Date(p.endISO) - new Date(p.startISO)) / 86400000) + 1;

    const formattedStart = formatDate(p.startISO);
    const formattedEnd = formatDate(p.endISO);

    row.innerHTML = `
      <div>
        <div class="font-semibold text-gray-900 dark:text-white">${p.label}</div>
        <div class="text-gray-500 dark:text-gray-400 text-sm">${formattedStart} &rarr; ${formattedEnd}</div>
        <div class="text-gray-400 dark:text-gray-500 text-xs">${days} ${days === 1 ? 'day' : 'days'}</div>
      </div>
      <div class="flex items-center gap-2">
        <button class="edit-period w-8 h-8 flex items-center justify-center rounded-full border border-ios-blue text-ios-blue hover:bg-ios-blue/10" aria-label="Edit"><span class="material-icons text-ios-blue">edit</span></button>
        <button class="delete-period w-8 h-8 flex items-center justify-center rounded-full border border-red-500 text-red-600 hover:bg-red-600/10" aria-label="Delete"><span class="material-icons text-red-600">delete</span></button>
      </div>`;

    // Edit logic – open form modal pre-filled
    row.querySelector('.edit-period').addEventListener('click', () => {
      openPeriodForm({ mode: 'edit', period: p });
    });

    // Delete period
    row.querySelector('.delete-period').addEventListener('click', () => {
      showConfirm({
        title: 'Delete Holiday Period',
        message: 'Are you sure you want to delete this period? This cannot be undone.',
        okText: 'Delete',
        cancelText: 'Cancel',
        onOK: () => {
          deletePeriod(p.id);
          refreshPeriodList();
        },
      });
    });

    wrap.appendChild(row);
  });
}
