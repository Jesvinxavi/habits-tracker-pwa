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
  closeModal('focus-test-modal-2');
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

  it('keeps focus and aria ownership on the top of a stacked dialog', () => {
    const { modal, opener } = addModal();
    openModal('focus-test-modal');
    const firstModalFocus = document.getElementById('first-focus');

    const second = document.createElement('div');
    second.id = 'focus-test-modal-2';
    second.className = 'hidden';
    second.innerHTML = '<h2>Second</h2><button id="second-focus">Second action</button>';
    document.body.appendChild(second);
    firstModalFocus.focus();
    openModal('focus-test-modal-2');

    expect(modal.getAttribute('aria-hidden')).toBe('true');
    expect(document.activeElement.id).toBe('second-focus');
    expect(Number(second.style.zIndex)).toBeGreaterThan(Number(modal.style.zIndex));

    closeModal('focus-test-modal-2');
    expect(modal.hasAttribute('aria-hidden')).toBe(false);
    expect(document.activeElement).toBe(firstModalFocus);

    closeModal('focus-test-modal');
    expect(document.activeElement).toBe(opener);
  });
});
