import { defineConfig } from "tsdown";

export default defineConfig({
  workspace: {
    include: ["packages/*"],
    exclude: ["packages/test-utils"],
  },
  entry: ["src/index.ts"],
  target: "node26",
  dts: {
    generator: "oxc",
  },
  minify: true,
  exports: {
    inlinedDependencies: false,
  },
  deps: {
    alwaysBundle: ["@clerc/advanced-types"],
    neverBundle: [/^@clerc\//],
    onlyBundle: false,
  },
});
