// Swipeable Card helper
//
// The caller is responsible for providing a container that wraps the list item
// and includes a `.restore-btn` element that triggers the restore action.

export function makeCardSwipable(
  swipeContainer,
  slideEl,
  habit,
  { onRestore = () => {}, revealMode = 'translate' } = {}
) {
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let isSwiping = false;

  let btnWidth = 0; // lazy-computed

  let activePointerId = null;

  function setTranslate(x) {
    if (revealMode === 'resize') {
      slideEl.style.width = `calc(100% + ${x}px)`;
      slideEl.style.transform = 'translateX(0)';
      return;
    }
    slideEl.style.transform = `translateX(${x}px)`;
  }

  function onPointerDown(e) {
    const pt = e.touches ? e.touches[0] : e;
    startX = pt.clientX;
    startY = pt.clientY;
    currentX = 0;
    isSwiping = false; // we determine later
    btnWidth = swipeContainer.offsetWidth * 0.2;
    activePointerId = e.pointerId !== undefined ? e.pointerId : null;
  }

  function onPointerMove(e) {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    const pt = e.touches ? e.touches[0] : e;
    const dx = pt.clientX - startX;
    const dy = pt.clientY - startY;

    // If we haven't decided yet whether this is a swipe, check threshold
    if (!isSwiping) {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
        // Begin horizontal swipe
        isSwiping = true;
        slideEl.style.transition = 'none';
        // Capture only after a real horizontal swipe starts. Capturing on
        // pointerdown retargets ordinary taps away from buttons inside the card.
        if (e.pointerId !== undefined && slideEl.setPointerCapture) {
          slideEl.setPointerCapture(e.pointerId);
        }
      } else {
        return; // let vertical scroll proceed
      }
    }

    // horizontal swipe handling
    currentX = dx;
    if (currentX > 0) currentX = 0; // left only
    if (currentX < -btnWidth) currentX = -btnWidth;
    setTranslate(currentX);
  }

  function onPointerUp(e) {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    if (!isSwiping) {
      activePointerId = null;
      return; // Not a swipe; nothing to snap back
    }

    isSwiping = false;
    slideEl.style.transition = revealMode === 'resize' ? 'width 0.2s' : 'transform 0.2s';
    if (Math.abs(currentX) > btnWidth / 2) {
      setTranslate(-btnWidth);
    } else {
      setTranslate(0);
    }
    if (e.pointerId !== undefined && slideEl.releasePointerCapture) {
      slideEl.releasePointerCapture(e.pointerId);
    }
    activePointerId = null;
  }

  // basic styles
  slideEl.style.cursor = 'grab';
  slideEl.style.touchAction = 'pan-y'; // allow vertical scroll by default

  // wire listeners (pointer events)
  slideEl.addEventListener('pointerdown', onPointerDown);
  slideEl.addEventListener('pointermove', onPointerMove);
  slideEl.addEventListener('pointerup', onPointerUp);

  // Fallback for older Safari (touch events)
  slideEl.addEventListener(
    'touchmove',
    (e) => {
      if (isSwiping) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // Restore button handler
  swipeContainer.querySelector('.restore-btn')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    if (button.disabled) return;
    button.disabled = true;
    const restored = await onRestore();
    if (restored !== false) setTranslate(0);
    if (button.isConnected) button.disabled = false;
  });
}
