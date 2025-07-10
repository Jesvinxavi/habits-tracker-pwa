// Icon Picker module – extracted from habits/form.js
// ------------------------------------------------------

import { openModal, closeModal } from '../../../components/Modal.js';

export let selectedIcon = '📋';

export function getSelectedIcon() {
  return selectedIcon;
}

export function setSelectedIcon(icon) {
  selectedIcon = icon;
}

const ICONS = [
  '💪',
  '🏃',
  '🚴',
  '🏊',
  '🧘',
  '⚖️', // Health & Fitness
  '🍎',
  '🥗',
  '💧',
  '☕',
  '🥛',
  '🍊', // Food & Drink
  '📚',
  '📖',
  '✏️',
  '🎓',
  '💡',
  '🧠', // Education & Reading
  '💼',
  '💻',
  '📱',
  '📊',
  '📝',
  '📋', // Work & Productivity
  '😴',
  '🛏️',
  '🌙',
  '⏰',
  '🕐',
  '⏱️', // Sleep & Rest
  '🎵',
  '🎸',
  '🎨',
  '📷',
  '🎮',
  '🎯', // Hobbies & Entertainment
  '🌱',
  '🌳',
  '🌸',
  '🌞',
  '🌍',
  '♻️', // Nature & Environment
  '👥',
  '👪',
  '❤️',
  '🤝',
  '📞',
  '💬', // Social & Family
  '🧼',
  '🪥',
  '🚿',
  '💊',
  '🧴',
  '🎯', // Personal Care
  '✈️',
  '🚗',
  '🚶',
  '🗺️',
  '🎒',
  '📍', // Travel
  '💰',
  '💳',
  '💎',
  '📈',
  '🏦',
  '💸', // Money
  '⭐',
  '🎉',
  '🔥',
  '⚡',
  '✨',
  '🚀', // General Symbols
];

let gridBuilt = false;

function buildIconGrid(modal) {
  if (gridBuilt) return;
  const grid = modal.querySelector('#icon-grid');
  if (!grid) {
    console.warn('Icon grid element not found in modal');
    return;
  }
  
  // Clear any existing content first
  grid.innerHTML = '';
  
  const fragment = document.createDocumentFragment();
  ICONS.forEach((icon) => {
    const btn = document.createElement('button');
    btn.className =
      'icon-option w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xl hover:bg-ios-blue hover:text-white transition-all duration-200 hover:scale-105';
    btn.dataset.icon = icon;
    btn.textContent = icon;
    fragment.appendChild(btn);
  });
  grid.appendChild(fragment);
  gridBuilt = true;
}

export function initIconPicker() {
  const btn = document.getElementById('icon-selector-btn');
  const modal = document.getElementById('icon-selection-modal');
  const display = document.getElementById('selected-icon-display');
  if (!btn || !modal || !display) return;

  // Build grid once
  buildIconGrid(modal);

  // Helper to update UI display
  function updateDisplay() {
    display.textContent = selectedIcon;
  }

  btn.addEventListener('click', () => {
    // Ensure grid is built before opening modal
    buildIconGrid(modal);
    
    // Verify grid was successfully built
    const grid = modal.querySelector('#icon-grid');
    if (grid && grid.children.length > 0) {
      openModal('icon-selection-modal');
    } else {
      console.error('Failed to build icon grid, cannot open modal');
    }
  });

  // Close when clicking outside content
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal('icon-selection-modal');
  });

  const selectBtn = document.getElementById('select-icon');
  const cancelBtn = document.getElementById('cancel-icon');

  function clearHighlights() {
    modal
      .querySelectorAll('.icon-option')
      .forEach((btn) => btn.classList.remove('ring', 'ring-ios-blue', 'ring-2'));
  }

  modal.addEventListener('click', (e) => {
    const opt = e.target.closest('.icon-option');
    if (!opt) return;
    setSelectedIcon(opt.dataset.icon || '📋');
    clearHighlights();
    opt.classList.add('ring', 'ring-ios-blue', 'ring-2');
    selectBtn.disabled = false;
  });

  selectBtn?.addEventListener('click', () => {
    updateDisplay();
    closeModal('icon-selection-modal');
  });

  cancelBtn?.addEventListener('click', () => closeModal('icon-selection-modal'));

  updateDisplay();
}
