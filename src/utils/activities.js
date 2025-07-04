import { appData, mutate } from '../core/state.js';
import { generateUniqueId } from './uid.js';

/**
 * Add a new activity to the activities list
 */
export function addActivity(activityData) {
  const newActivity = {
    id: generateUniqueId(),
    name: activityData.name,
    categoryId: activityData.categoryId,
    icon:
      activityData.icon ||
      appData.activityCategories.find((c) => c.id === activityData.categoryId)?.icon ||
      '🎯',
    createdAt: new Date().toISOString(),
    ...activityData,
  };

  mutate((state) => {
    state.activities.push(newActivity);
  });

  return newActivity;
}

/**
 * Record an activity for a specific date
 */
export function recordActivity(activityId, date, data = {}) {
  const activity = appData.activities.find((a) => a.id === activityId);
  if (!activity) return null;

  const isoDate = date.slice(0, 10); // Ensure YYYY-MM-DD format
  const record = {
    id: generateUniqueId(),
    activityId,
    activityName: activity.name,
    categoryId: activity.categoryId,
    date: isoDate,
    timestamp: new Date().toISOString(),
    duration: data.duration || null,
    intensity: data.intensity || null,
    notes: data.notes || '',
    ...data,
  };

  mutate((state) => {
    if (!state.recordedActivities[isoDate]) {
      state.recordedActivities[isoDate] = [];
    }
    state.recordedActivities[isoDate].push(record);
  });

  return record;
}

/**
 * Get activities recorded for a specific date
 */
export function getActivitiesForDate(date) {
  const isoDate = date.slice(0, 10);
  return appData.recordedActivities[isoDate] || [];
}

/**
 * Get all activities grouped by category
 */
export function getActivitiesByCategory() {
  const grouped = {};

  appData.activityCategories.forEach((category) => {
    grouped[category.id] = {
      category,
      activities: appData.activities.filter((activity) => activity.categoryId === category.id),
    };
  });

  return grouped;
}

/**
 * Search activities by name
 */
export function searchActivities(query) {
  if (!query || query.trim() === '') {
    return appData.activities;
  }

  const searchTerm = query.toLowerCase().trim();
  return appData.activities.filter((activity) => activity.name.toLowerCase().includes(searchTerm));
}

/**
 * Delete a recorded activity
 */
export function deleteRecordedActivity(recordId, date) {
  const isoDate = date.slice(0, 10);

  mutate((state) => {
    if (state.recordedActivities[isoDate]) {
      state.recordedActivities[isoDate] = state.recordedActivities[isoDate].filter(
        (record) => record.id !== recordId
      );

      // Remove empty date entries
      if (state.recordedActivities[isoDate].length === 0) {
        delete state.recordedActivities[isoDate];
      }
    }
  });
}

/**
 * Update a recorded activity
 */
export function updateRecordedActivity(recordId, date, data = {}) {
  const isoDate = date.slice(0, 10);

  mutate((state) => {
    if (state.recordedActivities[isoDate]) {
      const recordIndex = state.recordedActivities[isoDate].findIndex(
        (record) => record.id === recordId
      );
      if (recordIndex !== -1) {
        // Update the existing record with new data while preserving ID and timestamp
        state.recordedActivities[isoDate][recordIndex] = {
          ...state.recordedActivities[isoDate][recordIndex],
          ...data,
        };
      }
    }
  });
}

/**
 * Get activity category by ID
 */
export function getActivityCategory(categoryId) {
  return appData.activityCategories.find((cat) => cat.id === categoryId);
}

/**
 * Get activity by ID
 */
export function getActivity(activityId) {
  return appData.activities.find((activity) => activity.id === activityId);
}

// Console assertions for testing (when NODE_ENV === 'test')
if (typeof window !== 'undefined' && window.process?.env?.NODE_ENV === 'test') {
  // console.group('🧪 Testing activities utility...');

  // Test 1: Activity creation
  const testActivity = addActivity({
    name: 'Test Running',
    categoryId: 'cardio',
    icon: '🏃‍♂️',
  });
  // console.assert(testActivity.id, 'Activity should have an ID');
  // console.assert(testActivity.name === 'Test Running', 'Activity should have correct name');
  // console.assert(testActivity.categoryId === 'cardio', 'Activity should have correct category');

  // Test 2: Activity recording
  const testDate = '2024-01-15';
  const testRecord = recordActivity(testActivity.id, testDate, {
    duration: 30,
    intensity: 'moderate',
    notes: 'Great run!',
  });
  // console.assert(testRecord, 'Should create activity record');
  // console.assert(testRecord.duration === 30, 'Record should have correct duration');
  // console.assert(testRecord.intensity === 'moderate', 'Record should have correct intensity');

  // Test 3: Get activities for date
  const activitiesForDate = getActivitiesForDate(testDate);
  // console.assert(activitiesForDate.length > 0, 'Should find activities for date');
  // console.assert(
  //   activitiesForDate[0].activityName === 'Test Running',
  //   'Should find correct activity'
  // );

  // Test 4: Search functionality
  const searchResults = searchActivities('running');
  // console.assert(searchResults.length > 0, 'Should find activities by search');
  // console.assert(
  //   searchResults[0].name.toLowerCase().includes('running'),
  //   'Search should match activity name'
  // );

  // Test 5: Category grouping
  const grouped = getActivitiesByCategory();
  // console.assert(grouped.cardio, 'Should have cardio category');
  // console.assert(grouped.cardio.activities.length > 0, 'Cardio category should have activities');

  // Test 6: Activity retrieval
  const retrievedActivity = getActivity(testActivity.id);
  // console.assert(retrievedActivity, 'Should retrieve activity by ID');
  // console.assert(retrievedActivity.name === 'Test Running', 'Retrieved activity should match');

  // Test 7: Category retrieval
  const category = getActivityCategory('cardio');
  // console.assert(category, 'Should retrieve category by ID');
  // console.assert(category.name === 'Cardio', 'Category should have correct name');

  // Test 8: Delete functionality
  const recordId = testRecord.id;
  deleteRecordedActivity(recordId, testDate);
  const activitiesAfterDelete = getActivitiesForDate(testDate);
  // console.assert(activitiesAfterDelete.length === 0, 'Activity should be deleted');

  // Test 9: Invalid inputs
  // console.assert(!getActivity('invalid-id'), 'Should return null for invalid activity ID');
  // console.assert(
  //   !getActivityCategory('invalid-category'),
  //   'Should return undefined for invalid category'
  // );
  // console.assert(
  //   searchActivities('').length === appData.activities.length,
  //   'Empty search should return all activities'
  // );

  // Clean up test data
  mutate((state) => {
    state.activities = state.activities.filter((a) => a.id !== testActivity.id);
  });

  // console.log('✅ All activities utility tests passed!');
  // console.groupEnd();
}
