/**
 * Materialises one inert Fitness modal shell on first use. The source template
 * is parsed without creating live controls, event targets, focusable elements
 * or layout work during startup.
 * @param {string} modalId
 * @returns {HTMLElement|null}
 */
export function ensureFitnessModalMarkup(modalId) {
  const existing = document.getElementById(modalId);
  if (existing) return existing;

  const template = document.getElementById('fitness-modal-markup');
  if (!(template instanceof HTMLTemplateElement)) return null;
  const source = template.content.querySelector(`[id="${modalId}"]`);
  if (!source) return null;
  const modal = source.cloneNode(true);
  document.body.appendChild(modal);
  return modal;
}
