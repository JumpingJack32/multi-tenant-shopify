// apps/admin/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tells Next.js to transpile these local monorepo packages
  transpilePackages: [
    "@repo/codegen",
    "@repo/tenant-orm",
    "@repo/ui",
    "@repo/shared-utils",
  ],
  experimental: {
    optimizePackageImports: ["@repo/ui"],
  },
};

export default nextConfig;
