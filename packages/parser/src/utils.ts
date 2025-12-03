import type { FlagOptions } from "./types";

export function setValueByType(
	flags: any,
	key: string,
	value: string,
	config: FlagOptions,
) {
	const { type } = config;
	if (Array.isArray(type)) {
		(flags[key] ??= []).push(type[0](value));
	} else {
		flags[key] = type(value);
	}
}

export function setDotValues(obj: any, path: string, value: any) {
	const keys = path.split(".");
	let current = obj;
	for (let i = 0; i < keys.length - 1; i++) {
		const key = keys[i];
		current[key] ??= {};
		current = current[key];
	}
	const lastKey = keys[keys.length - 1];
	if (value === "true" || value === "") {
		current[lastKey] = true;
	} else if (value === "false") {
		current[lastKey] = false;
	} else {
		current[lastKey] = value;
	}
}
