let currentSearch = '';

function performSearch(term) {
  currentSearch = term.toLowerCase();

  // If the term is empty just ensure all elements are visible and names restored
  if (!currentSearch) {
    document.querySelectorAll('.habit-item').forEach((el) => {
      el.style.display = '';
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

      // Highlight the matching part(s)
      const regex = new RegExp(`(${currentSearch.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
      nameEl.innerHTML = originalText.replace(regex, '<mark>$1</mark>');
    } else {
      // Hide item
      el.style.display = 'none';
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
  const input = document.querySelector('.search-container input');
  if (!input) return;

  // Create a clear (X) button if it doesn't exist yet
  let clearBtn = document.querySelector('.search-container .clear-search');
  if (!clearBtn) {
    clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className =
      'clear-search absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hidden';
    clearBtn.innerHTML =
      '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const wrapper = document.querySelector('.search-input');
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
