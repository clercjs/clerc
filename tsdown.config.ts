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
	clean: true,
	fixedExtension: false,
	external: ["@clerc/core"],
});
