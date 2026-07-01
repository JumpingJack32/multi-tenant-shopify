import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["packages/*/src/**", "apps/*/src/**"],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/node_modules/**"],
      thresholds: {
        lines: 15,
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
        test: {
          name: "storefront",
          root: "./apps/storefront",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
        },
      },
      {
        test: {
          name: "auth",
          root: "./packages/auth",
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
