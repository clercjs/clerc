import TsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [TsconfigPaths()],
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
