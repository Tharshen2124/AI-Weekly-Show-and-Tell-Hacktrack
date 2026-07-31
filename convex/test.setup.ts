/// <reference types="vite/client" />

// convex-test needs the module map to run functions in tests.
export const modules = import.meta.glob([
  "./**/*.ts",
  "./**/*.js",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
]);
