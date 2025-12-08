import type { Clerc } from "../cli";

export interface Plugin {
	setup: (cli: Clerc) => Clerc;
}
