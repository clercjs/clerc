import { Clerc as ClercBase } from "@clerc/core";
import { helpPlugin } from "@clerc/plugin-help";
import { versionPlugin } from "@clerc/plugin-version";

export * from "./re-exports";

// @ts-expect-error TS2675
export class Clerc extends ClercBase {
	public static create(
		options?: Parameters<typeof ClercBase.create>[0],
	): ClercBase {
		const instance = super.create(options);
		instance.use(helpPlugin()).use(versionPlugin());

		return instance;
	}
}
