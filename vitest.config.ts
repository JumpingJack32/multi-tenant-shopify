import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["packages/*/src/**", "apps/*/src/**"],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/node_modules/**",
        "**/index.ts",
        "**/types.ts",
        "**/data-table.tsx",
        "**/motion.tsx",
        "**/table.tsx",
        "**/base-ui.ts",
        "**/__tests__/**",
        "apps/admin/src/app/**",
        "apps/admin/src/hooks/**",
        "apps/admin/src/lib/**",
        "apps/admin/src/types/**",
        "apps/storefront/src/app/**",
        "apps/storefront/src/proxy.ts",
        "apps/storefront/src/components/providers.tsx",
        "apps/storefront/src/components/storefront/cart.tsx",
        "apps/storefront/src/lib/utils.ts",
        "packages/auth/src/provider.tsx",
        "packages/auth/src/server.ts",
        "packages/tenant-orm/src/schemas/global.ts",
        "packages/ui/src/styles/**",
        "packages/ui/src/components/ui/**",
      ],
      thresholds: {
        lines: 30,
      },
    },
    projects: [
      {
        test: {
          name: "shared-utils",
          root: "./packages/shared-utils",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "tenant-orm",
          root: "./packages/tenant-orm",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "middleware",
          root: "./packages/middleware",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            "@": new URL("./apps/storefront/src", import.meta.url).pathname,
          },
        },
        test: {
          name: "storefront",
          root: "./apps/storefront",
          environment: "jsdom",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          setupFiles: ["./src/__tests__/setup.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "auth",
          root: "./packages/auth",
          environment: "jsdom",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "ui",
          root: "./packages/ui",
          environment: "jsdom",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          setupFiles: ["./src/__tests__/setup.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            "@": new URL("./apps/admin/src", import.meta.url).pathname,
          },
        },
        test: {
          name: "admin",
          root: "./apps/admin",
          environment: "jsdom",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
        },
      },
    ],
  },
});
