import type { FlagOptions } from "./types";

export const isArrayOfType = (arr: any, type: any): boolean =>
	Array.isArray(arr) && arr[0] === type;

export function setValueByType(
	flags: any,
	key: string,
	value: string,
	config: FlagOptions,
) {
	const { type } = config;
	if (Array.isArray(type)) {
		if (isArrayOfType(type, Boolean)) {
			flags[key] = (flags[key] ?? 0) + 1;
		} else {
			(flags[key] ??= []).push(type[0](value));
		}
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

export const toCamelCase = (str: string) =>
	str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
export const isNumber = (str: string) => !Number.isNaN(Number(str));
export const isFlag = (str: string) => str.startsWith("-") && !isNumber(str);

export function splitNameAndValue(arg: string, delimiters: string[]) {
	let sepIdx = -1;
	let usedDelimiter = "";
	for (const delimiter of delimiters) {
		const idx = arg.indexOf(delimiter);
		if (idx !== -1 && (sepIdx === -1 || idx < sepIdx)) {
			sepIdx = idx;
			usedDelimiter = delimiter;
		}
	}
	const hasSep = sepIdx !== -1;
	const rawName = hasSep ? arg.slice(2, sepIdx) : arg.slice(2);
	const rawValue = hasSep
		? arg.slice(sepIdx + usedDelimiter.length)
		: undefined;

	return { rawName, rawValue, hasSep };
}
