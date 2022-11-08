import { resolve } from "node:path";
import type { AliasOptions } from "vite";
import { defineConfig } from "vitest/config";

const r = (p: string) => resolve(__dirname, p);

export const alias: AliasOptions = {
  "clerc": r("./packages/clerc/src"),
  "@clerc/plugin-help": r("./packages/plugin-help/src"),
};

export default defineConfig({
  resolve: {
    alias,
  },
  test: {
    isolate: false,
  },
});
