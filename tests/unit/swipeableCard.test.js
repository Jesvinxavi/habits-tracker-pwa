import { describe, expect, it, vi } from 'vitest';
import { makeCardSwipable } from '../../src/components/swipeableCard.js';

function pointerEvent(type, { pointerId = 1, clientX = 0, clientY = 0 } = {}) {
  const event = new MouseEvent(type, { bubbles: true, clientX, clientY });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event;
}

describe('swipeable card controls', () => {
  it('does not capture an ordinary button tap as a swipe', () => {
    const container = document.createElement('div');
    const slide = document.createElement('div');
    const button = document.createElement('button');
    const capture = vi.fn();
    const release = vi.fn();
    slide.setPointerCapture = capture;
    slide.releasePointerCapture = release;
    slide.appendChild(button);
    container.appendChild(slide);

    makeCardSwipable(container, slide, {});
    button.dispatchEvent(pointerEvent('pointerdown', { clientX: 20, clientY: 20 }));
    button.dispatchEvent(pointerEvent('pointerup', { clientX: 20, clientY: 20 }));

    expect(capture).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it('captures the pointer only after a horizontal swipe begins', () => {
    const container = document.createElement('div');
    const slide = document.createElement('div');
    const capture = vi.fn();
    slide.setPointerCapture = capture;
    slide.releasePointerCapture = vi.fn();
    container.appendChild(slide);

    makeCardSwipable(container, slide, {});
    slide.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 20 }));
    slide.dispatchEvent(pointerEvent('pointermove', { clientX: 70, clientY: 22 }));

    expect(capture).toHaveBeenCalledWith(1);
  });
});
