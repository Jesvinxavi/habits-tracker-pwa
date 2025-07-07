// ColorPicker.js - Category color picker component

/**
 * Opens a lightweight color picker popup for category color selection
 * @param {HTMLElement} button - The category edit button that triggered the picker
 * @param {Function} onColorChange - Callback when color is selected
 */
export function openCategoryColorPicker(button, onColorChange) {
  const categoryId = button.dataset.categoryId;

  // Remove any existing color picker
  const existingPicker = document.querySelector('.category-color-picker');
  if (existingPicker) {
    existingPicker.remove();
  }

  // Create color picker popup
  const colorPicker = document.createElement('div');
  colorPicker.className =
    'category-color-picker bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700';
  colorPicker.style.cssText = `
    position: absolute;
    z-index: 1000;
    border-radius: 12px;
    padding: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    width: 180px;
    max-width: 180px;
  `;

  // Available colors with gradients (matching habits page)
  const colorOptions = [
    { hex: '#ef4444', gradient: 'from-red-500 to-red-600', shadow: 'hover:shadow-red-500/25' },
    {
      hex: '#f97316',
      gradient: 'from-orange-500 to-orange-600',
      shadow: 'hover:shadow-orange-500/25',
    },
    {
      hex: '#eab308',
      gradient: 'from-yellow-500 to-yellow-600',
      shadow: 'hover:shadow-yellow-500/25',
    },
    {
      hex: '#22c55e',
      gradient: 'from-green-500 to-green-600',
      shadow: 'hover:shadow-green-500/25',
    },
    { hex: '#06b6d4', gradient: 'from-cyan-500 to-cyan-600', shadow: 'hover:shadow-cyan-500/25' },
    { hex: '#3b82f6', gradient: 'from-blue-500 to-blue-600', shadow: 'hover:shadow-blue-500/25' },
    {
      hex: '#8b5cf6',
      gradient: 'from-violet-500 to-violet-600',
      shadow: 'hover:shadow-violet-500/25',
    },
    { hex: '#ec4899', gradient: 'from-pink-500 to-pink-600', shadow: 'hover:shadow-pink-500/25' },
    {
      hex: '#64748b',
      gradient: 'from-slate-500 to-slate-600',
      shadow: 'hover:shadow-slate-500/25',
    },
    { hex: '#374151', gradient: 'from-gray-700 to-gray-800', shadow: 'hover:shadow-gray-500/25' },
    { hex: '#7c2d12', gradient: 'from-red-900 to-red-950', shadow: 'hover:shadow-red-900/25' },
    {
      hex: '#166534',
      gradient: 'from-green-800 to-green-900',
      shadow: 'hover:shadow-green-800/25',
    },
  ];

  // Get current category color to show selection
  const currentColor = button.style.backgroundColor;
  const currentHex = rgbToHex(currentColor);

  // Create color options
  colorOptions.forEach(({ hex, gradient, shadow }) => {
    const colorOption = document.createElement('button');
    colorOption.className = `color-option w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} shadow-lg hover:scale-110 transition-all duration-200 ${shadow}`;

    // Add selection ring if this is the current color
    if (hex === currentHex) {
      colorOption.classList.add(
        'ring-2',
        'ring-black',
        'dark:ring-white',
        'ring-offset-2',
        'ring-offset-white',
        'dark:ring-offset-gray-800'
      );
    }

    colorOption.addEventListener('click', () => {
      if (onColorChange) {
        onColorChange(categoryId, hex, button);
      }
      colorPicker.remove();
    });

    colorPicker.appendChild(colorOption);
  });

  // Position the picker near the button
  const buttonRect = button.getBoundingClientRect();
  const searchContainer = document.querySelector('#activities-search-section');
  const containerRect = searchContainer.getBoundingClientRect();

  // Position to the left of the button
  colorPicker.style.top = `${buttonRect.top - containerRect.top}px`;
  colorPicker.style.right = `${containerRect.right - buttonRect.left + 8}px`;

  // Add to search container
  searchContainer.appendChild(colorPicker);

  // Close picker when clicking outside
  const closePickerOnClick = (e) => {
    if (!colorPicker.contains(e.target) && e.target !== button) {
      colorPicker.remove();
      document.removeEventListener('click', closePickerOnClick);
    }
  };

  // Add delay to prevent immediate closing
  setTimeout(() => {
    document.addEventListener('click', closePickerOnClick);
  }, 100);
}

/**
 * Updates the search category button color immediately
 * @param {HTMLElement} button - The category edit button
 * @param {string} newColor - The new color hex value
 */
export function updateSearchCategoryButton(button, newColor) {
  button.style.backgroundColor = newColor;
}

/**
 * Converts RGB color to hex format
 * @param {string} rgb - RGB color string
 * @returns {string} Hex color string
 */
function rgbToHex(rgb) {
  if (!rgb) return '';

  // Handle hex colors that are already in the correct format
  if (rgb.startsWith('#')) {
    return rgb;
  }

  // Handle rgb() format
  const result = rgb.match(/\d+/g);
  if (!result || result.length < 3) return '';

  const r = parseInt(result[0]);
  const g = parseInt(result[1]);
  const b = parseInt(result[2]);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
