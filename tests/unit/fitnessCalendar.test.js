import { describe, expect, it, vi } from 'vitest';
import {
  FitnessCalendar,
  setFitnessCalendarApi,
} from '../../src/features/fitness/FitnessCalendar.js';

describe('fitness calendar controller', () => {
  it('keeps custom-element calendar methods bound to their element', () => {
    const api = {
      ready: Promise.resolve(),
      selected: null,
      setDate(date) {
        this.selected = date;
      },
      scrollToSelected: vi.fn(function scrollToSelected() {
        return this;
      }),
    };

    setFitnessCalendarApi(api);
    const selected = new Date('2026-07-28T00:00:00');

    FitnessCalendar.setDate(selected);

    expect(api.selected).toBe(selected);
    expect(FitnessCalendar.scrollToSelected()).toBe(api);
  });
});
