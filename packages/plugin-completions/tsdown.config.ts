import { defineConfig } from "tsdown";

import base from "../../tsdown.config.ts";

export default defineConfig({
	...base,
	dts: {
		build: true,
	},
});
