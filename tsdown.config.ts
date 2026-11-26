import { defineConfig } from "tsdown";

export default defineConfig({
  workspace: {
    include: ["packages/*"],
    exclude: ["packages/test-utils"],
  },
  entry: ["src/{index,prompts}.ts"],
  target: "node24",
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
