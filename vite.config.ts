import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import tsconfigBase from "./tsconfig.base.json";

const __dirname = dirname(fileURLToPath(import.meta.url));

const alias = Object.fromEntries(
	Object.keys(tsconfigBase.compilerOptions.paths ?? {}).map((key) => {
		const { paths } = tsconfigBase.compilerOptions;
		const path = paths[key as keyof typeof paths][0];
		if (!path) {
			throw new Error(`Path for ${key} not found`);
		}

		return [key, join(__dirname, path)];
	}),
);

export default defineConfig({
	resolve: {
		alias,
	},
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
