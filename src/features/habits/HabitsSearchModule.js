let currentSearch = '';

/**
 * Mounts the search panel component
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onSearch - Callback when search is performed
 * @returns {HTMLElement} The search panel element
 */
export function mountSearchPanel(callbacks = {}) {
  const searchContainer = document.createElement('div');
  searchContainer.className = 'search-container mb-3 px-4';

  searchContainer.innerHTML = `
    <div class="search-input relative border-2 border-gray-300 dark:border-gray-500 rounded-xl bg-gray-100 dark:bg-gray-700 transition-all duration-300 ease-out shadow-sm hover:shadow-md hover:-translate-y-0.5 focus-within:shadow-lg focus-within:-translate-y-1 focus-within:border-blue-500 dark:focus-within:border-blue-400 hover:border-gray-400 dark:hover:border-gray-400">
      <svg class="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <input id="activity-search" placeholder="Search activities..." class="w-full pl-10 pr-4 py-3 bg-transparent text-gray-700 dark:text-gray-300 rounded-xl border-none outline-none focus:ring-0 transition-colors cursor-pointer placeholder-gray-500 dark:placeholder-gray-400" autocomplete="off" spellcheck="false">
    </div>
  `;



  return searchContainer;
}

function performSearch(term) {
  currentSearch = term.toLowerCase();

  // If the term is empty just ensure all elements are visible and names restored
  if (!currentSearch) {
    document.querySelectorAll('.habit-item').forEach((el) => {
      el.style.display = '';
      const row = el.closest('.habit-row');
      if (row) row.style.display = '';
    });
    document.querySelectorAll('.category-section').forEach((section) => {
      section.style.display = '';
    });

    // Remove previous highlights and restore original names
    document.querySelectorAll('.habit-name').forEach((nameEl) => {
      if (nameEl.dataset.originalName) {
        nameEl.textContent = nameEl.dataset.originalName;
      }
    });
    return;
  }

  // Highlight matches and hide non-matching items
  document.querySelectorAll('.habit-item').forEach((el) => {
    const nameEl = el.querySelector('.habit-name');
    if (!nameEl) return;

    // Cache original name text once
    if (!nameEl.dataset.originalName) {
      nameEl.dataset.originalName = nameEl.textContent;
    }
    const originalText = nameEl.dataset.originalName;
    const lower = originalText.toLowerCase();

    if (lower.includes(currentSearch)) {
      // Show the item
      el.style.display = '';
      const row = el.closest('.habit-row');
      if (row) row.style.display = '';

      // Highlight the matching part(s)
      const regex = new RegExp(`(${currentSearch.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
      nameEl.innerHTML = originalText.replace(regex, '<mark>$1</mark>');
    } else {
      // Hide item
      el.style.display = 'none';
      const row = el.closest('.habit-row');
      if (row) row.style.display = 'none';
      // Remove highlight if previously applied
      nameEl.textContent = originalText;
    }
  });

  // hide category if all habits hidden
  document.querySelectorAll('.category-section').forEach((section) => {
    const visibleHabit = section.querySelector('.habit-item:not([style*="display: none"])');
    section.style.display = visibleHabit ? '' : 'none';
  });
}

function handleSearch(e) {
  performSearch(e.target.value.trim());
}

export function initializeSearch() {
  // Scope to the Habits view to avoid interference with other search panels
  const viewRoot = document.getElementById('habits-view') || document;
  const input = viewRoot.querySelector('.search-container input');
  if (!input) return;

  // Create a clear (X) button if it doesn't exist yet (scoped)
  let clearBtn = viewRoot.querySelector('.search-container .clear-search');
  if (!clearBtn) {
    clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className =
      'clear-search absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hidden';
    clearBtn.innerHTML =
      '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const wrapper = viewRoot.querySelector('.search-input');
    if (wrapper) wrapper.appendChild(clearBtn);
  }

  // Show / hide clear button depending on input value
  function toggleClearBtn() {
    if (input.value.length) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  // Clear handler
  clearBtn.addEventListener('click', () => {
    input.value = '';
    toggleClearBtn();
    performSearch('');
    input.blur();
  });

  // Initial state and on input change
  toggleClearBtn();
  input.addEventListener('input', handleSearch);

  // Also toggle clear button when typing
  input.addEventListener('input', toggleClearBtn);
}
