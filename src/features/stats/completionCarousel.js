/**
 * The swipeable completion-rate tile, in one place.
 *
 * There were two of these — one on the Stats page, one in the habit modal —
 * built from the same copied code but drifted to different autoscroll cadences,
 * and both hard-coded the same element ids. Opening the modal over the page put
 * two `#habit-completion-carousel` nodes in one document, so whichever the page
 * looked up by id was a coin toss.
 *
 * This version scopes everything to the element it is handed and returns a
 * teardown function, so a caller cannot leak an interval by forgetting one.
 */

import { escapeHtml } from '../../shared/sanitize.js';

/** Long enough to read the figure, short enough that the tile is worth swiping. */
const AUTOSCROLL_MS = 12000;
const SWIPE_THRESHOLD_PX = 40;

/**
 * Renders the completion-rate windows as a swipeable tile.
 * @param {Array<{label: string, rate: number}>} periods Windows, first shown first.
 * @returns {string} Carousel markup.
 */
export function renderPeriodCarousel(periods) {
  if (!periods || periods.length === 0) return '';

  const slide = (period, index) => `
    <div class="carousel-slide ${index === 0 ? 'active' : ''}" data-slide="${index}">
      <div class="text-2xl font-bold text-center text-gray-900 dark:text-white">${period.rate.toFixed(1)}%</div>
      <div class="text-center text-xs text-gray-500 dark:text-gray-400 mt-0.5">Completed (${escapeHtml(period.label)})</div>
    </div>
  `;

  if (periods.length === 1) {
    return `<div class="rounded-xl bg-gray-50 dark:bg-gray-800/70 p-3">${slide(periods[0], 0)}</div>`;
  }

  return `
    <div class="completion-carousel rounded-xl bg-gray-50 dark:bg-gray-800/70 p-3" data-carousel>
      <div class="carousel-container">
        <div class="carousel-track">${periods.map(slide).join('')}</div>
      </div>
      <div class="carousel-dots">
        ${periods.map((_, index) => `<div class="carousel-dot ${index === 0 ? 'active' : ''}" data-slide="${index}"></div>`).join('')}
      </div>
    </div>
  `;
}

/**
 * Wires up every carousel inside a container.
 * @param {Element|Document|null} root Where to look for carousels.
 * @returns {() => void} Teardown, which stops the timers and detaches handlers.
 */
export function mountPeriodCarousel(root) {
  if (!root) return () => {};
  const carousels = [...root.querySelectorAll('[data-carousel]')];
  const teardowns = carousels.map(wireCarousel).filter(Boolean);
  return () => teardowns.forEach((teardown) => teardown());
}

/**
 * Wires one carousel.
 * @param {Element} carousel The carousel element.
 * @returns {(() => void)|null} Teardown, or null when there is nothing to wire.
 */
function wireCarousel(carousel) {
  const track = carousel.querySelector('.carousel-track');
  const slides = [...(track?.querySelectorAll('.carousel-slide') || [])];
  const dots = [...carousel.querySelectorAll('.carousel-dot')];
  if (slides.length <= 1) return null;

  let index = 0;
  let timer = null;
  const controller = new AbortController();
  const { signal } = controller;

  const show = (next) => {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, position) => slide.classList.toggle('active', position === index));
    dots.forEach((dot, position) => dot.classList.toggle('active', position === index));
  };

  const start = () => {
    stop();
    timer = setInterval(() => show(index + 1), AUTOSCROLL_MS);
  };
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  dots.forEach((dot, position) =>
    dot.addEventListener(
      'click',
      (event) => {
        event.stopPropagation();
        show(position);
        start();
      },
      { signal }
    )
  );

  let pointerStartX = null;
  carousel.addEventListener(
    'pointerdown',
    (event) => {
      pointerStartX = event.clientX;
      stop();
    },
    { signal }
  );
  carousel.addEventListener(
    'pointerup',
    (event) => {
      if (pointerStartX !== null) {
        const travelled = pointerStartX - event.clientX;
        if (Math.abs(travelled) > SWIPE_THRESHOLD_PX) show(index + (travelled > 0 ? 1 : -1));
      }
      pointerStartX = null;
      start();
    },
    { signal }
  );
  carousel.addEventListener(
    'pointercancel',
    () => {
      pointerStartX = null;
      start();
    },
    { signal }
  );
  carousel.addEventListener('mouseenter', stop, { signal });
  carousel.addEventListener('mouseleave', start, { signal });

  carousel.style.cursor = 'grab';
  start();

  return () => {
    stop();
    controller.abort();
  };
}
