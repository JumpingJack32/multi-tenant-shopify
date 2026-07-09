import config from "@repo/eslint-config";

export default [
  {
    ignores: ["**/next-env.d.ts"],
  },
  {
    files: ["**/next-env.d.ts"],
    rules: {
      "import/no-unresolved": "off",
    },
  },
  ...config,
];
