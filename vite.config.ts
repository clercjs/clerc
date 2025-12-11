import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tsconfigPaths()],
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
