/**
 * Toggles one activity category without measuring its content. CSS owns the
 * visual transition; this helper owns interaction and accessibility state.
 * @param {HTMLElement} section Category section element.
 * @returns {boolean} Whether the section is expanded after the toggle.
 */
export function toggleCategoryDisclosure(section) {
  if (!section) return false;
  const content = section.querySelector('.search-category-content');
  if (!content) return false;

  const expanded = section.classList.contains('collapsed');
  section.classList.toggle('collapsed', !expanded);

  const button = section.querySelector('.search-expand-btn');
  button?.setAttribute('aria-expanded', String(expanded));
  const categoryName =
    section.querySelector('.category-title span:last-child')?.textContent?.trim() || 'category';
  button?.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${categoryName}`);

  content.setAttribute('aria-hidden', String(!expanded));
  content.toggleAttribute('inert', !expanded);
  return expanded;
}

/**
 * Binds category headers and chevrons inside one rendered list.
 * @param {HTMLElement} container Rendered category container.
 * @param {(categoryId:string, expanded:boolean)=>void} [onToggle] State callback.
 * @returns {void}
 */
export function bindCategoryDisclosureEvents(container, onToggle = null) {
  if (!container) return;

  const toggle = (section) => {
    const expanded = toggleCategoryDisclosure(section);
    onToggle?.(section?.dataset.categoryId, expanded);
  };

  container.querySelectorAll('.search-expand-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      toggle(button.closest('.search-category-section'));
    });
  });

  container.querySelectorAll('.search-category-header').forEach((header) => {
    header.addEventListener('click', (event) => {
      // Controls inside a category header own their clicks. This keeps the
      // Activity Library's edit action from also toggling the disclosure.
      if (event.target.closest('button, a, input, select, textarea')) return;
      toggle(header.closest('.search-category-section'));
    });
  });
}
