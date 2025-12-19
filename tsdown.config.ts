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
	fixedExtension: false,
	external: [/^@clerc\//],
});
