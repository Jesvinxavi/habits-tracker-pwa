const category = { id: 'health', name: 'Health', color: '#22C55E' };

export function emptyLegacySnapshot() {
  return {
    categories: [],
    habits: [],
    holidayDates: [],
    holidayPeriods: [],
    settings: {
      darkMode: false,
      hideCompleted: false,
      hideSkipped: false,
      holidayMode: false,
    },
    activities: [],
    activityCategories: [],
    recordedActivities: {},
    restDays: {},
    foodLog: [],
    stats: {},
    appFirstOpenDate: '2024-01-01T00:00:00.000Z',
  };
}

export function comprehensiveLegacySnapshot() {
  const base = emptyLegacySnapshot();
  return {
    ...base,
    categories: [category],
    habits: [
      {
        id: 'daily-water',
        categoryId: category.id,
        name: 'Water',
        frequency: 'daily',
        createdAt: '2024-01-01T00:00:00.000Z',
        completed: { '2025-01-01': true },
        progress: { '2025-01-01': '2', '2025-W2': 3 },
        skippedDates: ['2025-01', '2025-BW3', '2025'],
        target: 8,
        targetFrequency: 'daily',
        targetUnit: 'glasses',
        defaultIncrement: 1,
      },
      {
        id: 'monthly-review',
        categoryId: category.id,
        name: 'Review',
        frequency: 'monthly',
        monthly: { interval: 1, mode: 'on', dates: [1], combinations: ['first-monday'] },
        createdAt: '2024-02-03',
        completed: false,
      },
    ],
    holidayPeriods: [
      { id: 'holiday-1', start: '2025-07-01', end: '2025-07-03', label: 'Trip' },
    ],
    holidayDates: ['2025-07-02', '2025-08-01'],
    activityCategories: [
      { id: 'strength', name: 'Strength', color: '#2563EB', icon: '💪' },
    ],
    activities: [
      {
        id: 'squat',
        name: 'Squat',
        categoryId: 'strength',
        icon: '🏋️',
        trackingType: 'sets-reps',
        createdAt: '2024-01-01',
      },
    ],
    recordedActivities: {
      '2025-01-02': [
        {
          id: 'record-1',
          activityId: 'squat',
          activityName: 'Squat',
          categoryId: 'strength',
          date: '2025-01-02',
          timestamp: '2025-01-02T08:00:00.000Z',
          duration: '15',
          durationUnit: 'minutes',
          sets: [{ reps: '5', value: '40', unit: 'kg' }],
          notes: 'Good',
        },
      ],
    },
    restDays: { '2025-01-03': true },
    foodLog: [{ name: 'Apple' }],
    stats: { oldStreak: 3 },
    experimentalField: { retained: true },
  };
}

export function legacySourcePairs() {
  const complete = comprehensiveLegacySnapshot();
  return {
    matching: { localSnapshot: complete, indexedSnapshot: structuredClone(complete) },
    domainDifference: {
      localSnapshot: complete,
      indexedSnapshot: { ...complete, categories: [...complete.categories, { id: 'work', name: 'Work' }] },
    },
    deviceOnlyDifference: {
      localSnapshot: { ...complete, selectedDate: '2025-01-01' },
      indexedSnapshot: { ...complete, selectedDate: '2025-01-02' },
    },
    corruptLocal: { localRaw: '{bad json', indexedSnapshot: complete },
    corruptIndexed: { localSnapshot: complete, indexedSnapshot: 'not-an-object' },
  };
}
