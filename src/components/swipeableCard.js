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
  // Where the card already sits when the gesture starts. A revealed card is at
  // -btnWidth, so without this the pointer delta is measured from the wrong
  // origin and closing never tracks the finger.
  let startOffset = 0;
  let isSwiping = false;

  let btnWidth = 0; // lazy-computed
  let availableLeftShift = 0;

  let activePointerId = null;

  function setTranslate(x) {
    if (revealMode === 'translate-within-viewport') {
      const revealWidth = Math.max(0, -x);
      const translateWidth = Math.min(revealWidth, availableLeftShift);
      const resizeWidth = revealWidth - translateWidth;
      slideEl.style.width = `calc(100% - ${resizeWidth}px)`;
      slideEl.style.transform = `translateX(${-translateWidth}px)`;
      return;
    }
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
    isSwiping = false; // we determine later
    btnWidth = swipeContainer.offsetWidth * 0.2;
    availableLeftShift = Math.max(0, swipeContainer.getBoundingClientRect().left);
    startOffset = swipeContainer.classList.contains('swipe-revealed') ? -btnWidth : 0;
    currentX = startOffset;
    activePointerId = e.pointerId !== undefined ? e.pointerId : null;
  }

  function onPointerMove(e) {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    const pt = e.touches ? e.touches[0] : e;
    const dy = pt.clientY - startY;

    // If we haven't decided yet whether this is a swipe, check threshold
    if (!isSwiping) {
      const travelled = pt.clientX - startX;
      if (Math.abs(travelled) > 12 && Math.abs(travelled) > Math.abs(dy)) {
        // Begin horizontal swipe.
        isSwiping = true;
        // Rebase to where the finger is now, so this frame's delta is zero. The
        // 12px spent deciding the gesture was horizontal would otherwise be
        // applied in one step and the card would start its travel with a jump.
        startX = pt.clientX;
        // Stop treating the card as revealed for the duration of the drag. The
        // revealed state lifts the action button above the sliding card, so a
        // card closing from a previously released reveal travelled behind the
        // button and only jumped in front when the class came off at release.
        // Dragging open and closed in one motion never hit this, because the
        // class is only ever applied on release.
        swipeContainer.classList.remove('swipe-revealed');
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

    // horizontal swipe handling, from wherever the card already was
    currentX = startOffset + (pt.clientX - startX);
    if (currentX > 0) currentX = 0; // never past closed
    if (currentX < -btnWidth) currentX = -btnWidth; // never past fully revealed
    setTranslate(currentX);
  }

  function onPointerUp(e) {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    if (!isSwiping) {
      activePointerId = null;
      return; // Not a swipe; nothing to snap back
    }

    isSwiping = false;
    slideEl.style.transition =
      revealMode === 'translate-within-viewport'
        ? 'width 0.2s, transform 0.2s'
        : revealMode === 'resize'
          ? 'width 0.2s'
          : 'transform 0.2s';
    const shouldReveal = Math.abs(currentX) > btnWidth / 2;
    if (shouldReveal) {
      setTranslate(-btnWidth);
    } else {
      setTranslate(0);
    }
    swipeContainer.classList.toggle('swipe-revealed', shouldReveal);
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
    if (restored !== false) {
      setTranslate(0);
      swipeContainer.classList.remove('swipe-revealed');
    }
    if (button.isConnected) button.disabled = false;
  });
}
