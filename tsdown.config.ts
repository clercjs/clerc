import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	fixedExtension: false,
	external: ["@clerc/core"],
});
