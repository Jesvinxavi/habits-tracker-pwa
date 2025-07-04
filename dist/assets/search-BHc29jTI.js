let a = '';
function o(r) {
  if (((a = r.toLowerCase()), !a)) {
    document.querySelectorAll('.habit-item').forEach((e) => {
      e.style.display = '';
    }),
      document.querySelectorAll('.category-section').forEach((e) => {
        e.style.display = '';
      }),
      document.querySelectorAll('.habit-name').forEach((e) => {
        e.dataset.originalName && (e.textContent = e.dataset.originalName);
      });
    return;
  }
  document.querySelectorAll('.habit-item').forEach((e) => {
    const t = e.querySelector('.habit-name');
    if (!t) return;
    t.dataset.originalName || (t.dataset.originalName = t.textContent);
    const n = t.dataset.originalName;
    if (n.toLowerCase().includes(a)) {
      e.style.display = '';
      const i = new RegExp(`(${a.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
      t.innerHTML = n.replace(i, '<mark>$1</mark>');
    } else (e.style.display = 'none'), (t.textContent = n);
  }),
    document.querySelectorAll('.category-section').forEach((e) => {
      const t = e.querySelector('.habit-item:not([style*="display: none"])');
      e.style.display = t ? '' : 'none';
    });
}
function l(r) {
  o(r.target.value.trim());
}
function s() {
  const r = document.querySelector('.search-container input');
  if (!r) return;
  let e = document.querySelector('.search-container .clear-search');
  if (!e) {
    (e = document.createElement('button')),
      (e.type = 'button'),
      (e.className =
        'clear-search absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hidden'),
      (e.innerHTML =
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    const n = document.querySelector('.search-input');
    n && n.appendChild(e);
  }
  function t() {
    r.value.length ? e.classList.remove('hidden') : e.classList.add('hidden');
  }
  e.addEventListener('click', () => {
    (r.value = ''), t(), o(''), r.blur();
  }),
    t(),
    r.addEventListener('input', l),
    r.addEventListener('input', t);
}
export { s as initializeSearch };
