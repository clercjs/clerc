import { defineConfig } from "tsdown";

export default defineConfig({
  workspace: {
    include: ["packages/*"],
    exclude: ["packages/test-utils"],
  },
  entry: ["src/index.ts"],
  target: "node26",
  dts: true,
  minify: true,
  exports: {
    inlinedDependencies: false,
  },
  deps: {
    neverBundle: [/^@clerc\//, "clerc"],
    onlyBundle: false,
  },
});
