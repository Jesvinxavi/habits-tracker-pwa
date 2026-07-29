import { getState } from '../../../core/state.js';

let indexedSource = null;
let cachedIndex = null;

/**
 * Builds the shared fitness-history index once per recordedActivities object.
 * Reducers replace that object on every record change, so reference identity is
 * a complete and cheap invalidation key.
 * @param {Object<string, object[]>} [recordedActivities]
 * @returns {{allRecords: object[], byActivity: Map<string, object[]>, byDate: Map<string, object[]>}}
 */
export function getRecordedHistoryIndex(
  recordedActivities = getState().recordedActivities || {}
) {
  if (recordedActivities === indexedSource && cachedIndex) return cachedIndex;

  const allRecords = [];
  const byActivity = new Map();
  const byDate = new Map();

  Object.entries(recordedActivities).forEach(([dateKey, records]) => {
    byDate.set(dateKey, records);
    records.forEach((record) => {
      allRecords.push(record);
      if (!byActivity.has(record.activityId)) byActivity.set(record.activityId, []);
      byActivity.get(record.activityId).push(record);
    });
  });

  byActivity.forEach((records) => {
    records.sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));
  });

  indexedSource = recordedActivities;
  cachedIndex = { allRecords, byActivity, byDate };
  return cachedIndex;
}
