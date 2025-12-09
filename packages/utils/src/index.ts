import type { MaybeArray } from "./types";

export type * from "./types";

export const toArray = <T>(a: MaybeArray<T>): T[] =>
	Array.isArray(a) ? a : [a];

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

export const getReadableCommandName = (parameters: string[]): string =>
	parameters.length > 0 ? parameters.join(" ") : "<root>";
