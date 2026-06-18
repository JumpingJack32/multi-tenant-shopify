import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@repo/codegen": "../../packages/codegen/src",
      "@repo/tenant-orm": "../../packages/tenant-orm/src",
      "@repo/ui": "../../packages/ui/src",
      "@repo/shared-utils": "../../packages/shared-utils/src",
    };
    return config;
  },

};

export default nextConfig;
