import { so1ve } from "@so1ve/eslint-config";

export default so1ve(
  {
    rules: {
      "no-console": "off",
      "ts/no-empty-object-type": "off",
    },
  },
  {
    files: ["examples/**"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["packages/*/src/**"],
    ignores: ["packages/test-utils/**"],
    rules: {
      "no-restricted-imports": ["error", "clerc"],
    },
  },
);
