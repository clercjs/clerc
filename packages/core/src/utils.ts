import { looseIsArray } from "@clerc/utils";
import type { ClercFlagDefinitionValue, ClercFlagOptions } from "clerc";
import { IS_DENO, IS_ELECTRON, IS_NODE } from "is-platform";

export const resolveArgv = (): string[] =>
	IS_NODE
		? process.argv.slice(IS_ELECTRON ? 1 : 2)
		: IS_DENO
			? // @ts-expect-error Ignore
				Deno.args
			: [];

export const normalizeFlagValue = (
	flag: ClercFlagDefinitionValue,
): ClercFlagOptions =>
	typeof flag === "function" || looseIsArray(flag) ? { type: flag } : flag;
