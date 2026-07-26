/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as activities from "../activities.js";
import type * as activityCategories from "../activityCategories.js";
import type * as activityRecords from "../activityRecords.js";
import type * as bootstrap from "../bootstrap.js";
import type * as dataTransfer from "../dataTransfer.js";
import type * as desiredDates from "../desiredDates.js";
import type * as habitCategories from "../habitCategories.js";
import type * as habitEntries from "../habitEntries.js";
import type * as habits from "../habits.js";
import type * as history from "../history.js";
import type * as holidayPeriods from "../holidayPeriods.js";
import type * as holidays from "../holidays.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_checksum from "../lib/checksum.js";
import type * as lib_domain from "../lib/domain.js";
import type * as lib_envelopes from "../lib/envelopes.js";
import type * as lib_idempotency from "../lib/idempotency.js";
import type * as lib_revisions from "../lib/revisions.js";
import type * as lib_validators from "../lib/validators.js";
import type * as maintenance from "../maintenance.js";
import type * as migration from "../migration.js";
import type * as preferences from "../preferences.js";
import type * as profiles from "../profiles.js";
import type * as programs from "../programs.js";
import type * as reorder from "../reorder.js";
import type * as restDays from "../restDays.js";
import type * as routines from "../routines.js";
import type * as sync from "../sync.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  activities: typeof activities;
  activityCategories: typeof activityCategories;
  activityRecords: typeof activityRecords;
  bootstrap: typeof bootstrap;
  dataTransfer: typeof dataTransfer;
  desiredDates: typeof desiredDates;
  habitCategories: typeof habitCategories;
  habitEntries: typeof habitEntries;
  habits: typeof habits;
  history: typeof history;
  holidayPeriods: typeof holidayPeriods;
  holidays: typeof holidays;
  "lib/auth": typeof lib_auth;
  "lib/checksum": typeof lib_checksum;
  "lib/domain": typeof lib_domain;
  "lib/envelopes": typeof lib_envelopes;
  "lib/idempotency": typeof lib_idempotency;
  "lib/revisions": typeof lib_revisions;
  "lib/validators": typeof lib_validators;
  maintenance: typeof maintenance;
  migration: typeof migration;
  preferences: typeof preferences;
  profiles: typeof profiles;
  programs: typeof programs;
  reorder: typeof reorder;
  restDays: typeof restDays;
  routines: typeof routines;
  sync: typeof sync;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
