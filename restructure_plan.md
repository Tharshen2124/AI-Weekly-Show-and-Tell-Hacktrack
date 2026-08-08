# Project Restructuring Plan

Based on your suggestions, here is the detailed plan to restructure the project:

## 1. Move Tests to its Own Folder
We will create a top-level `tests/` directory to hold all test files.
- Move `convex/members.test.ts` -> `tests/convex/members.test.ts`
- Move `convex/lib/metrics.test.ts` -> `tests/convex/lib/metrics.test.ts`
- Move `convex/test.setup.ts` -> `tests/convex/test.setup.ts`
- Update `vitest.config.mts` to point to the new test location (`include: ["tests/**/*.test.ts"]`).

## 2. Move Convex Action Functions
We will create a new folder `convex/actions/` (or `convex/api/` if you prefer) and move the API endpoints there.
- Move `auth.ts`, `dashboard.ts`, `meetups.ts`, `members.ts`, `projects.ts`, `updates.ts` into `convex/actions/`.
- Move internal mutators like `seed.ts` and `bootstrap.ts` into `convex/actions/` as well.
- **Important Consequence**: Convex auto-generates the `api` object based on the file paths. By moving these files into an `actions/` folder, the API usage in the Next.js app will change from `api.members.method` to `api.actions.members.method`.
- We will perform a search and replace across the `src/` directory to update all instances of `api.<filename>` to `api.actions.<filename>` to ensure the Next.js app continues to work perfectly.
