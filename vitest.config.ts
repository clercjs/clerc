import { resolve } from "node:path";
import type { AliasOptions } from "vite";
import { defineConfig } from "vitest/config";

const r = (p: string) => resolve(__dirname, p);

export const alias: AliasOptions = {
  "@clerc/core": r("./packages/core/src"),
  "@clerc/utils": r("./packages/utils/src"),
  "@clerc/toolkit": r("./packages/toolkit/src"),
  "@clerc/plugin-help": r("./packages/plugin-help/src"),
  "@clerc/plugin-not-found": r("./packages/plugin-not-found/src"),
  "@clerc/plugin-completions": r("./packages/plugin-completions/src"),
  "@clerc/plugin-strict-flags": r("./packages/plugin-strict-flags/src"),
};

export default defineConfig({
  resolve: {
    alias,
  },
  test: {
    isolate: false,
  },
});
