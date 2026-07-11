import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "openapi.json",
  output: "src/client",
  plugins: [
    "@hey-api/client-fetch",
    "@hey-api/typescript", // Generates the types
    "@hey-api/sdk", // Generates the fetch functions
    "zod", // Generates the Zod validation schemas
  ],
});
