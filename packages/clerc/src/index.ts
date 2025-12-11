import { Clerc } from "@clerc/core";
import { helpPlugin } from "@clerc/plugin-help";
import { versionPlugin } from "@clerc/plugin-version";

export * from "./re-exports";

export const Cli = (): Clerc =>
	Clerc.create().use(versionPlugin()).use(helpPlugin());
