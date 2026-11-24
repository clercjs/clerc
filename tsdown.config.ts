import { readFileSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "tsdown";

export default defineConfig({
  workspace: {
    include: ["packages/*"],
    exclude: ["packages/test-utils"],
  },
  entry: ["src/index.ts"],
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
  plugins: [
    {
      name: "raw-text",
      resolveId(source, importer) {
        if (source.endsWith("?raw") && importer) {
          return `${path.resolve(path.dirname(importer), source.slice(0, -4))}?raw`;
        }
      },
      load(id) {
        if (id.endsWith("?raw")) {
          return `export default ${JSON.stringify(readFileSync(id.slice(0, -4), "utf8"))};`;
        }
      },
    },
  ],
});
