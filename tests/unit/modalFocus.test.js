import { afterEach, describe, expect, it } from 'vitest';
import { closeModal, openModal } from '../../src/components/Modal.js';

function addModal() {
  const opener = document.createElement('button');
  opener.textContent = 'Open';
  const modal = document.createElement('div');
  modal.id = 'focus-test-modal';
  modal.className = 'hidden';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Focus test</h2>
      <button id="first-focus">First</button>
      <button id="last-focus">Last</button>
    </div>
  `;
  document.body.append(opener, modal);
  opener.focus();
  return { modal, opener };
}

afterEach(() => {
  closeModal('focus-test-modal');
  document.body.replaceChildren();
});

describe('modal focus lifecycle', () => {
  it('labels the dialog, focuses inside it, and restores the opener', () => {
    const { modal, opener } = addModal();
    openModal('focus-test-modal');

    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(modal.getAttribute('aria-labelledby')).toBe('focus-test-modal-title');
    expect(document.activeElement.id).toBe('first-focus');

    closeModal('focus-test-modal');
    expect(document.activeElement).toBe(opener);
  });

  it('wraps Tab focus within the top modal', () => {
    addModal();
    openModal('focus-test-modal');
    document.getElementById('last-focus').focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement.id).toBe('first-focus');

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
    );
    expect(document.activeElement.id).toBe('last-focus');
  });
});
