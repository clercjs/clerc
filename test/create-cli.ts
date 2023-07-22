import { Clerc } from "@clerc/core";

export const Cli = (locale?: string) =>
	Clerc.create()
		.locale(locale ?? "en")
		.scriptName("test")
		.description("test")
		.version("0.0.0");
