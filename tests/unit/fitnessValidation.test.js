import { describe, expect, it } from 'vitest';
import {
  normalizeActivityCategory,
  normalizeActivityPresentation,
  normalizeFitnessIcon,
  normalizeFitnessPayload,
  normalizeRecordedActivity,
} from '../../src/shared/fitnessValidation.js';
import { ActivityCard } from '../../src/features/fitness/ActivityList/ActivityCard.js';

describe('Fitness presentation validation', () => {
  it('rejects markup-shaped icons and unsafe colours at the data boundary', () => {
    expect(normalizeFitnessIcon('<img src=x onerror=alert(1)>')).toBe('🎯');
    expect(
      normalizeActivityCategory({
        id: 'unsafe',
        color: 'red;background:url(javascript:alert(1))',
        icon: '<svg onload=alert(1)>',
      })
    ).toMatchObject({ color: '#64748B', icon: '🎯' });
  });

  it('normalises activity enums and record ranges without rejecting the account', () => {
    expect(
      normalizeActivityPresentation({
        trackingType: 'script',
        units: 'url(evil)',
        betterDirection: 'sideways',
      })
    ).toMatchObject({ trackingType: 'time', units: 'none', betterDirection: 'higher' });

    expect(
      normalizeRecordedActivity({
        duration: 1000,
        durationUnit: 'days',
        intensity: 'extreme',
        sets: [
          { reps: 12.8, value: 50, unit: 'kg' },
          { reps: -1, value: Infinity, unit: 'evil' },
        ],
      })
    ).toEqual({
      duration: null,
      durationUnit: 'minutes',
      intensity: null,
      sets: [{ reps: 12, value: 50, unit: 'kg' }],
    });
  });

  it('normalises imported collections while preserving unrelated legacy fields', () => {
    const payload = normalizeFitnessPayload({
      activityCategories: [{ id: 'c', color: 'bad', icon: '<b>x</b>' }],
      activities: [{ id: 'a', icon: '<i>x</i>', customLegacyField: true }],
      recordedActivities: { '2026-07-29': [{ id: 'r', duration: '30' }] },
      unknownLegacyTable: { keep: true },
    });
    expect(payload.activityCategories[0]).toMatchObject({ color: '#64748B', icon: '🎯' });
    expect(payload.activities[0]).toMatchObject({ icon: '🎯', customLegacyField: true });
    expect(payload.recordedActivities['2026-07-29'][0].duration).toBe(30);
    expect(payload.unknownLegacyTable).toEqual({ keep: true });
  });

  it('renders malicious record text as text and never as executable markup or CSS', () => {
    const markup = ActivityCard.build(
      {
        id: 'r"><img src=x>',
        activityId: 'a',
        activityName: '<img src=x onerror=alert(1)>',
        notes: '<script>alert(1)</script>',
        timestamp: '2026-07-29T12:00:00.000Z',
      },
      { icon: '<svg onload=alert(1)>', color: 'red;background:url(x)' }
    );
    const host = document.createElement('div');
    host.innerHTML = markup;

    expect(host.querySelector('img, script, svg')).toBeNull();
    expect(host.querySelector('.activity-name').textContent).toBe('<img src=x onerror=alert(1)>');
    expect(host.querySelector('.activity-notes').textContent).toBe('<script>alert(1)</script>');
    expect(host.querySelector('.activity-card').style.borderColor).toBe('rgb(100, 116, 139)');
  });
});
