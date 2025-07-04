/**
 * updatePrompt.js – shows a small banner asking the user to refresh when a new
 * Service Worker has taken control.
 */

function buildBanner() {
  if (document.getElementById('update-banner')) return null;
  const div = document.createElement('div');
  div.id = 'update-banner';
  div.className =
    'fixed inset-x-4 bottom-4 md:inset-x-auto md:right-4 md:bottom-4 z-50 ' +
    'flex items-center justify-between gap-4 px-4 py-3 rounded-xl shadow-lg ' +
    'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700';

  const text = document.createElement('span');
  text.className = 'text-sm font-medium text-gray-900 dark:text-gray-100';
  text.textContent = 'A new version is available.';

  const reloadBtn = document.createElement('button');
  reloadBtn.className =
    'px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-ios-blue ' +
    'hover:bg-ios-blue/90 focus:outline-none focus:ring-2 focus:ring-ios-blue/50';
  reloadBtn.textContent = 'Refresh';
  reloadBtn.addEventListener('click', () => location.reload());

  div.appendChild(text);
  div.appendChild(reloadBtn);
  document.body.appendChild(div);
  return div;
}

export function showUpdateBanner() {
  buildBanner();
}
