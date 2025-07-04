export function openModal(id) {
  const all = document.querySelectorAll(`#${id}`);
  const modal = all[all.length - 1];
  if (!modal) return;
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

export function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('hidden');
  modal.style.display = 'none';
  document.body.style.overflow = '';
}
