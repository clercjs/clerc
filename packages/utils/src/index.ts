import type { MaybeArray } from "./types";

export type * from "./types";

export const toArray = <T>(a: MaybeArray<T>): T[] =>
	Array.isArray(a) ? a : [a];

/**
 * Converts a dash-separated string to camelCase.
 * Not using regexp for better performance, because this function is used in parser.
 */
export function camelCase(str: string): string {
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

export function joinWithAnd(values: string[]): string {
	if (values.length === 0) {
		return "";
	}
	if (values.length === 1) {
		return values[0];
	}

	const last = values.pop();

	return `${values.join(", ")} and ${last}`;
}

export const kebabCase = <T extends string>(s: T): string =>
	s.replace(/([A-Z])/g, (_, c) => `-${c.toLowerCase()}`);

export const formatFlagName = (n: string): string =>
	n.length <= 1 ? `-${n}` : `--${kebabCase(n)}`;

export const formatVersion = (v: string): string =>
	v.length === 0 ? "" : v.startsWith("v") ? v : `v${v}`;

export const isTruthy: <T>(
	item: T,
) => item is Exclude<T, false | null | undefined> = Boolean as any;

export const objectIsEmpty = (obj: Record<string, any>): boolean =>
	Object.keys(obj).length === 0;
