import { Clerc } from "@clerc/core";

export const Cli = (): Clerc =>
	Clerc.create().scriptName("test").description("test").version("0.0.0");
