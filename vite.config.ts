import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    exclude: [...configDefaults.exclude, "**/.devenv/**"],
    coverage: {
      provider: "istanbul",
    },
    server: {
      deps: {
        inline: ["vitest-console"],
      },
    },
    typecheck: {
      tsconfig: "tsconfig.non-isolated.json",
    },
    setupFiles: ["test/setup.ts"],
  },
});
