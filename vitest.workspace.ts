import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/shared-utils",
  "packages/tenant-orm",
  "packages/middleware",
  "apps/storefront",
  "packages/auth",
  "packages/ui",
  "apps/admin",
]);
