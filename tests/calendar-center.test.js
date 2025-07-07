/**
 * Unit tests for calendar centering functionality
 * Tests the new CalendarController API and scrollToSelected method
 */

// Mock DOM environment for testing
const { JSDOM } = require('jsdom');
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <body>
      <div id="calendar-container" style="width: 300px; overflow-x: auto;">
        <div class="week-days" style="width: 1000px;">
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-01T00:00:00.000Z">1</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-02T00:00:00.000Z">2</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-03T00:00:00.000Z">3</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-04T00:00:00.000Z">4</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-05T00:00:00.000Z">5</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-06T00:00:00.000Z">6</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-07T00:00:00.000Z">7</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-08T00:00:00.000Z">8</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-09T00:00:00.000Z">9</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-10T00:00:00.000Z">10</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-11T00:00:00.000Z">11</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-12T00:00:00.000Z">12</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-13T00:00:00.000Z">13</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-14T00:00:00.000Z">14</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-15T00:00:00.000Z">15</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-16T00:00:00.000Z">16</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-17T00:00:00.000Z">17</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-18T00:00:00.000Z">18</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-19T00:00:00.000Z">19</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-20T00:00:00.000Z">20</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-21T00:00:00.000Z">21</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-22T00:00:00.000Z">22</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-23T00:00:00.000Z">23</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-24T00:00:00.000Z">24</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-25T00:00:00.000Z">25</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-26T00:00:00.000Z">26</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-27T00:00:00.000Z">27</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-28T00:00:00.000Z">28</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-29T00:00:00.000Z">29</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-30T00:00:00.000Z">30</div>
          <div class="day-item" style="width: 50px; display: inline-block;" data-date="2024-01-31T00:00:00.000Z">31</div>
        </div>
      </div>
    </body>
  </html>
`);

global.window = dom.window;
global.document = dom.window.document;

// Mock requestAnimationFrame for testing
global.requestAnimationFrame = (callback) => {
  setTimeout(callback, 0);
};

// Import the scroll helper
const { centerOnSelector } = require('../src/components/scrollHelpers.js');

describe('Calendar Centering Tests', () => {
  let container;
  let weekDays;

  beforeEach(() => {
    container = document.getElementById('calendar-container');
    weekDays = container.querySelector('.week-days');
  });

  test('should center tile #15 (middle tile)', () => {
    // Mark tile #15 as current-day
    const tiles = weekDays.querySelectorAll('.day-item');
    tiles[14].classList.add('current-day'); // 0-indexed, so tile 15 is at index 14

    // Call centerOnSelector
    centerOnSelector(weekDays, '.day-item.current-day', { instant: true });

    // Wait for rAF to complete
    setTimeout(() => {
      // Tile 15 should be centered
      // Container width: 300px, tile width: 50px
      // Expected scroll position: (14 * 50) - (300 - 50) / 2 = 700 - 125 = 575
      expect(weekDays.scrollLeft).toBeCloseTo(575, 0);
    }, 10);
  });

  test('should clamp first tile (tile #0)', () => {
    // Mark first tile as current-day
    const tiles = weekDays.querySelectorAll('.day-item');
    tiles[0].classList.add('current-day');

    // Call centerOnSelector
    centerOnSelector(weekDays, '.day-item.current-day', { instant: true });

    // Wait for rAF to complete
    setTimeout(() => {
      // Should clamp to 0 (can't scroll before first tile)
      expect(weekDays.scrollLeft).toBe(0);
    }, 10);
  });

  test('should clamp last tile (tile #30)', () => {
    // Mark last tile as current-day
    const tiles = weekDays.querySelectorAll('.day-item');
    tiles[30].classList.add('current-day');

    // Call centerOnSelector
    centerOnSelector(weekDays, '.day-item.current-day', { instant: true });

    // Wait for rAF to complete
    setTimeout(() => {
      // Should clamp to max scroll position
      // Max scroll: 1000 - 300 = 700
      expect(weekDays.scrollLeft).toBe(700);
    }, 10);
  });
});

// Only run tests if NODE_ENV is 'test'
if (process.env.NODE_ENV === 'test') {
  console.log('Running calendar centering tests...');
}
