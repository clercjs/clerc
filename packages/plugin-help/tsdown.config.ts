import { defineConfig } from "tsdown";

import base from "../../tsdown.config.ts";

export default defineConfig({
	...base,
	dts: {
		resolve: ["@clerc/parser"],
		oxc: true,
	},
});
