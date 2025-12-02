import type { FlagOptions } from "./types";

export function appendValue(
	flags: any,
	key: string,
	value: string,
	config: FlagOptions,
) {
	if (Array.isArray(config.type)) {
		(flags[key] ??= []).push(value);
	} else {
		flags[key] = value;
	}
}
