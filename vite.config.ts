import TsconfigAlias from "vite-plugin-simple-tsconfig-alias";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    TsconfigAlias({
      configNames: ["tsconfig.base.json"],
    }) as any,
  ],
  test: {
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
