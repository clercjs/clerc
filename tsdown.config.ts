import { defineConfig } from "tsdown";

export default defineConfig({
  workspace: {
    include: ["packages/*"],
    exclude: ["packages/test-utils"],
  },
  entry: ["src/index.ts"],
  dts: {
    oxc: true,
  },
  exports: true,
  external(id) {
    if (id === "@clerc/advanced-types") {
      return false;
    }

    return id.startsWith("@clerc/");
  },
});
