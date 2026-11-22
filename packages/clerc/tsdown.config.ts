import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/plugins/index.ts"],
  target: "node26",
  dts: true,
  minify: true,
  exports: {
    inlinedDependencies: false,
  },
  deps: {
    neverBundle: [/^@clerc\//],
    onlyBundle: false,
  },
});
