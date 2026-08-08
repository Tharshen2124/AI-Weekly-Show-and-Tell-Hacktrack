/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as functions_auth from "../functions/auth.js";
import type * as functions_bootstrap from "../functions/bootstrap.js";
import type * as functions_dashboard from "../functions/dashboard.js";
import type * as functions_meetups from "../functions/meetups.js";
import type * as functions_members from "../functions/members.js";
import type * as functions_projects from "../functions/projects.js";
import type * as functions_seed from "../functions/seed.js";
import type * as functions_updates from "../functions/updates.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_metrics from "../lib/metrics.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "functions/auth": typeof functions_auth;
  "functions/bootstrap": typeof functions_bootstrap;
  "functions/dashboard": typeof functions_dashboard;
  "functions/meetups": typeof functions_meetups;
  "functions/members": typeof functions_members;
  "functions/projects": typeof functions_projects;
  "functions/seed": typeof functions_seed;
  "functions/updates": typeof functions_updates;
  "lib/auth": typeof lib_auth;
  "lib/metrics": typeof lib_metrics;
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
