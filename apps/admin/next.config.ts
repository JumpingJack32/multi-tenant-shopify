import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@repo/codegen",
    "@repo/tenant-orm",
    "@repo/ui",
    "@repo/shared-utils",
    "@repo/editor",
  ],
  experimental: {
    optimizePackageImports: ["@repo/ui"],
  },
};

export default nextConfig;
