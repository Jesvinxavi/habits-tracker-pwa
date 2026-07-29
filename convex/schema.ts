import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const migrationStatus = v.union(
  v.literal("not_started"),
  v.literal("staging"),
  v.literal("awaiting_resolution"),
  v.literal("verifying"),
  v.literal("completed"),
  v.literal("failed"),
);

const shared = {
  ownerKey: v.string(),
  generation: v.number(),
  clientId: v.string(),
  revision: v.number(),
  updatedAt: v.number(),
  updatedByDeviceId: v.string(),
  deletedAt: v.optional(v.number()),
};

const sharedIndexes = <T extends ReturnType<typeof defineTable>>(table: T) =>
  table
    .index("by_owner_generation", ["ownerKey", "generation"])
    .index("by_owner_generation_client", ["ownerKey", "generation", "clientId"])
    .index("by_owner_generation_updatedAt", ["ownerKey", "generation", "updatedAt"]);

export default defineSchema({
  userProfiles: defineTable({
    ownerKey: v.string(),
    activeGeneration: v.number(),
    dataSchemaVersion: v.number(),
    appFirstOpenDate: v.string(),
    migrationStatus,
    activeMigrationBatchId: v.optional(v.string()),
    previousGeneration: v.optional(v.number()),
    migrationCompletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerKey"]),

  userPreferences: defineTable({
    ownerKey: v.string(),
    generation: v.number(),
    darkMode: v.boolean(),
    hideCompleted: v.boolean(),
    hideSkipped: v.boolean(),
    holidayMode: v.boolean(),
    // Optional so it can be added without invalidating existing preference rows.
    // Retired with the program preload feature: nothing writes or reads it, but
    // rows saved before it was dropped still hold a value and would otherwise
    // fail validation.
    programPreload: v.optional(v.boolean()),
    homeSectionVisibility: v.object({
      Completed: v.boolean(),
      Skipped: v.boolean(),
    }),
    revision: v.number(),
    updatedAt: v.number(),
    updatedByDeviceId: v.string(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_owner_generation", ["ownerKey", "generation"])
    .index("by_owner_generation_updatedAt", ["ownerKey", "generation", "updatedAt"]),

  habitCategories: sharedIndexes(
    defineTable({
      ...shared,
      name: v.string(),
      color: v.string(),
      sortOrder: v.number(),
    }),
  ).index("by_owner_generation_order", ["ownerKey", "generation", "sortOrder"]),

  habits: sharedIndexes(
    defineTable({
      ...shared,
      categoryClientId: v.string(),
      name: v.string(),
      frequency: v.union(
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("biweekly"),
        v.literal("monthly"),
        v.literal("yearly"),
      ),
      createdAtISO: v.string(),
      anchorDateISO: v.optional(v.string()),
      scheduledTime: v.optional(v.union(v.string(), v.null())),
      days: v.optional(v.array(v.number())),
      monthly: v.optional(
        v.object({
          interval: v.number(),
          mode: v.union(v.literal("each"), v.literal("on")),
          dates: v.optional(v.array(v.number())),
          combinations: v.optional(v.array(v.string())),
        }),
      ),
      months: v.optional(v.array(v.number())),
      yearInterval: v.optional(v.number()),
      paused: v.boolean(),
      activeOnHolidays: v.boolean(),
      icon: v.string(),
      target: v.optional(v.number()),
      targetFrequency: v.optional(
        v.union(
          v.literal("daily"),
          v.literal("weekly"),
          v.literal("biweekly"),
          v.literal("monthly"),
          v.literal("yearly"),
        ),
      ),
      targetUnit: v.optional(v.string()),
      defaultIncrement: v.optional(v.number()),
      // Removing a habit hides it from active dates without deleting the
      // definition or its habitEntries, which remain historical records.
      archivedAt: v.optional(v.number()),
      sortOrder: v.number(),
    }),
  )
    .index("by_owner_generation_category", ["ownerKey", "generation", "categoryClientId"])
    .index("by_owner_generation_order", ["ownerKey", "generation", "sortOrder"]),

  habitEntries: sharedIndexes(
    defineTable({
      ...shared,
      habitClientId: v.string(),
      periodKey: v.string(),
      periodSortDate: v.string(),
      completed: v.boolean(),
      progress: v.number(),
      skipped: v.boolean(),
    }),
  )
    .index("by_owner_generation_habit", ["ownerKey", "generation", "habitClientId"])
    .index("by_owner_generation_habit_period", [
      "ownerKey",
      "generation",
      "habitClientId",
      "periodKey",
    ])
    .index("by_owner_generation_sort_date", [
      "ownerKey",
      "generation",
      "periodSortDate",
    ]),

  holidayPeriods: sharedIndexes(
    defineTable({
      ...shared,
      startISO: v.string(),
      endISO: v.string(),
      label: v.string(),
    }),
  ).index("by_owner_generation_start", ["ownerKey", "generation", "startISO"]),

  holidaySingles: sharedIndexes(
    defineTable({ ...shared, dateKey: v.string() }),
  ).index("by_owner_generation_date", ["ownerKey", "generation", "dateKey"]),

  activityCategories: sharedIndexes(
    defineTable({
      ...shared,
      name: v.string(),
      color: v.string(),
      icon: v.string(),
      sortOrder: v.number(),
      isSystemDefault: v.boolean(),
    }),
  ).index("by_owner_generation_order", ["ownerKey", "generation", "sortOrder"]),

  activities: sharedIndexes(
    defineTable({
      ...shared,
      name: v.string(),
      categoryClientId: v.string(),
      icon: v.string(),
      createdAtISO: v.string(),
      trackingType: v.union(v.literal("time"), v.literal("sets-reps")),
      units: v.optional(v.string()),
      muscleGroup: v.optional(v.string()),
      // Free-text note kept against the activity itself, edited from the
      // activity details modal. Optional so existing rows stay valid.
      notes: v.optional(v.string()),
      // Which way is an improvement for a time-tracked activity: a 5k is better
      // lower, a plank better higher. Absent means higher, the old behaviour.
      betterDirection: v.optional(v.union(v.literal("higher"), v.literal("lower"))),
      // Set when the user removes the activity from their library. The row and
      // its records stay: the sessions are history, and a program's past weeks
      // resolve their tiles through the activity itself. Distinct from
      // deletedAt, which is the sync tombstone.
      archivedAt: v.optional(v.number()),
    }),
  ).index("by_owner_generation_category", [
    "ownerKey",
    "generation",
    "categoryClientId",
  ]),

  activityRecords: sharedIndexes(
    defineTable({
      ...shared,
      activityClientId: v.string(),
      activityNameSnapshot: v.string(),
      categoryClientIdSnapshot: v.string(),
      dateKey: v.string(),
      timestampISO: v.string(),
      duration: v.optional(v.number()),
      durationUnit: v.optional(
        v.union(v.literal("seconds"), v.literal("minutes"), v.literal("hours")),
      ),
      intensity: v.optional(v.string()),
      notes: v.string(),
      sets: v.optional(
        v.array(
          v.object({
            reps: v.number(),
            value: v.optional(v.number()),
            unit: v.string(),
          }),
        ),
      ),
    }),
  )
    .index("by_owner_generation_date", ["ownerKey", "generation", "dateKey"])
    .index("by_owner_generation_activity", ["ownerKey", "generation", "activityClientId"])
    .index("by_owner_generation_activity_date", [
      "ownerKey",
      "generation",
      "activityClientId",
      "dateKey",
    ]),

  routines: sharedIndexes(
    defineTable({
      ...shared,
      name: v.string(),
      activityClientIds: v.array(v.string()),
      createdAtISO: v.string(),
      // As on activities: removing a routine from the list archives it, so the
      // days it was planned on keep it.
      archivedAt: v.optional(v.number()),
      sortOrder: v.number(),
    }),
  ).index("by_owner_generation_order", ["ownerKey", "generation", "sortOrder"]),

  programs: sharedIndexes(
    defineTable({
      ...shared,
      name: v.string(),
      startDateISO: v.string(),
      endDateISO: v.string(),
      // Repeated dayOfWeek entries are allowed: a day may hold several items.
      // Each entry pins either a routine or a single activity, so both id
      // fields are optional and exactly one is set.
      scheduledDays: v.array(
        v.object({
          dayOfWeek: v.number(),
          routineClientId: v.optional(v.string()),
          activityClientId: v.optional(v.string()),
        }),
      ),
      // Retired with the two-mode scheduling scheme: nothing writes or reads
      // scheduleMode any more. It stays declared, and optional, because rows
      // written before it was dropped still hold a value and would otherwise
      // fail validation.
      scheduleMode: v.optional(
        v.union(v.literal("prescriptive"), v.literal("freeform")),
      ),
      restDays: v.optional(v.array(v.number())),
      // Also retired: a session now counts anywhere in its week, so a separate
      // anytime bucket says nothing a pinned day does not. Kept declared for
      // the same reason as scheduleMode. Each entry targeted a routine or a
      // single activity, so both id fields are optional.
      anytimeRoutines: v.optional(
        v.array(
          v.object({
            routineClientId: v.optional(v.string()),
            activityClientId: v.optional(v.string()),
            count: v.number(),
          }),
        ),
      ),
      // Schedules this program has been through, each closed off when the plan
      // was edited mid-block. Dates before a phase's end are measured against
      // it rather than against the live scheduledDays, so editing a running
      // program never rewrites the weeks it has already been through.
      schedulePhases: v.optional(
        v.array(
          v.object({
            startDateISO: v.string(),
            endDateISO: v.string(),
            scheduledDays: v.array(
              v.object({
                dayOfWeek: v.number(),
                routineClientId: v.optional(v.string()),
                activityClientId: v.optional(v.string()),
              }),
            ),
            restDays: v.optional(v.array(v.number())),
          }),
        ),
      ),
      // Free-text note kept against the program, edited from program details.
      notes: v.optional(v.string()),
      active: v.boolean(),
      createdAtISO: v.string(),
      sortOrder: v.number(),
    }),
  ).index("by_owner_generation_start", ["ownerKey", "generation", "startDateISO"]),

  restDays: sharedIndexes(
    defineTable({ ...shared, dateKey: v.string() }),
  ).index("by_owner_generation_date", ["ownerKey", "generation", "dateKey"]),

  legacyData: defineTable({
    ownerKey: v.string(),
    generation: v.number(),
    foodLog: v.any(),
    stats: v.any(),
    unknownTopLevelFields: v.any(),
    sourceSchemaVersion: v.number(),
    updatedAt: v.number(),
  }).index("by_owner_generation", ["ownerKey", "generation"]),

  processedOperations: defineTable({
    ownerKey: v.string(),
    operationId: v.string(),
    deviceId: v.string(),
    processedAt: v.number(),
    mutationName: v.string(),
    result: v.any(),
  })
    .index("by_owner_operation", ["ownerKey", "operationId"])
    .index("by_processed_at", ["processedAt"]),

  migrationBatches: defineTable({
    ownerKey: v.string(),
    batchId: v.string(),
    deviceId: v.string(),
    sourceFingerprint: v.string(),
    appFirstOpenDate: v.string(),
    baseGeneration: v.number(),
    targetGeneration: v.number(),
    expectedCounts: v.any(),
    expectedChecksums: v.any(),
    uploadedCounts: v.any(),
    status: v.union(
      v.literal("staging"),
      v.literal("awaiting_resolution"),
      v.literal("verifying"),
      v.literal("verified"),
      v.literal("activated"),
      v.literal("failed"),
      v.literal("abandoned"),
    ),
    conflictSummary: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    committedAt: v.optional(v.number()),
  })
    .index("by_owner_batch", ["ownerKey", "batchId"])
    .index("by_owner_fingerprint", ["ownerKey", "sourceFingerprint"])
    .index("by_owner_status", ["ownerKey", "status"]),

  collectionRevisions: defineTable({
    ownerKey: v.string(),
    generation: v.number(),
    collection: v.string(),
    revision: v.number(),
    updatedAt: v.number(),
    updatedByDeviceId: v.string(),
  }).index("by_owner_generation_collection", [
    "ownerKey",
    "generation",
    "collection",
  ]),
});
