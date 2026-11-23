import { so1ve } from "@so1ve/eslint-config";

export default so1ve(
  {
    rules: {
      "no-console": "off",
      "ts/no-empty-object-type": "off",
    },
  },
  {
    files: ["packages/clerc/src/cli.ts"],
    rules: {
      "ts/prefer-return-this-type": "off",
    },
  },
  {
    files: ["examples/**"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["packages/clerc/src/**", "packages/logger/src/**"],
    rules: {
      "no-restricted-imports": ["error", "clerc"],
    },
  },
);
