import { describe, expect, it } from 'vitest';
import {
  sanitizeActivityDefinition,
  sanitizeActivityRecord,
  sanitizeMutationPayload,
} from '../../src/core/operationPayload.js';

describe('Convex operation payloads', () => {
  it('omits null optional activity fields from new and queued writes', () => {
    const payload = {
      clientId: 'activity-1',
      name: 'Walk',
      units: null,
      muscleGroup: null,
    };
    expect(sanitizeActivityDefinition(payload)).toEqual({
      clientId: 'activity-1',
      name: 'Walk',
    });
    expect(sanitizeMutationPayload('activities:create', payload)).toEqual({
      clientId: 'activity-1',
      name: 'Walk',
    });
  });

  it('omits null optional activity-record fields, including set values', () => {
    expect(
      sanitizeActivityRecord({
        clientId: 'record-1',
        duration: null,
        durationUnit: null,
        intensity: null,
        sets: [{ reps: 10, value: null, unit: 'kg' }],
      })
    ).toEqual({
      clientId: 'record-1',
      sets: [{ reps: 10, unit: 'kg' }],
    });
  });
});
