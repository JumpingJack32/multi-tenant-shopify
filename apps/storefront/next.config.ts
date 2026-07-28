import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:tenant/shop/all",
        destination: "/:tenant/products",
        permanent: true,
      },
      {
        source: "/:tenant/shop/:category",
        destination: "/:tenant/products?category=:category",
        permanent: true,
      },
      {
        source: "/:tenant/shop/:category/:slug",
        destination: "/:tenant/products/:slug",
        permanent: true,
      },
    ];
  },
  images: {
    localPatterns: [
      {
        pathname: "/docs/images/**",
        search: "",
      },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.craiyon.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
  // Tells Next.js to transpile these local monorepo packages
  transpilePackages: [
    "@repo/codegen",
    "@repo/tenant-orm",
    "@repo/ui",
    "@repo/shared-utils",
    "@repo/editor",
  ],
};

export default nextConfig;
