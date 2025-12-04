import type { FlagOptions } from "./types";

export const strictIsArray = <T>(arr: any): arr is readonly T[] =>
	Array.isArray(arr);

export const isArrayOfType = (arr: any, type: any): boolean =>
	Array.isArray(arr) && arr[0] === type;

/**
 * Check if it's a letter (a-z: 97-122, A-Z: 65-90)
 */
export const isLetter = (charCode: number): boolean =>
	(charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122);

/**
 * Check if it's a digit (0-9: 48-57)
 */
export const isDigit = (charCode: number): boolean =>
	charCode >= 48 && charCode <= 57;

export function setValueByType(
	flags: any,
	key: string,
	value: string,
	config: FlagOptions,
) {
	const { type } = config;
	if (strictIsArray(type)) {
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

export function toCamelCase(str: string) {
	const dashIdx = str.indexOf("-");
	if (dashIdx === -1) {
		return str;
	}

	let result = str.slice(0, dashIdx);
	for (let i = dashIdx; i < str.length; i++) {
		if (str[i] === "-" && i + 1 < str.length) {
			const nextChar = str.charCodeAt(i + 1);
			if (nextChar >= 97 && nextChar <= 122) {
				result += String.fromCharCode(nextChar - 32);
				i++;
			} else {
				result += str[i + 1];
				i++;
			}
		} else if (str[i] !== "-") {
			result += str[i];
		}
	}

	return result;
}

export function splitNameAndValue(arg: string, delimiters: string[]) {
	let sepIdx = -1;
	let delimiterLen = 0;

	for (const delimiter of delimiters) {
		const idx = arg.indexOf(delimiter);
		if (idx !== -1 && (sepIdx === -1 || idx < sepIdx)) {
			sepIdx = idx;
			delimiterLen = delimiter.length;
		}
	}

	const hasSep = sepIdx !== -1;
	if (!hasSep) {
		return { rawName: arg, rawValue: undefined, hasSep: false };
	}

	return {
		rawName: arg.slice(0, sepIdx),
		rawValue: arg.slice(sepIdx + delimiterLen),
		hasSep: true,
	};
}
