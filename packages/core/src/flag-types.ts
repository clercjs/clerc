import type { TypeFunction } from "@clerc/parser";

/**
 * Creates a Enum type function that validates the input against allowed values.
 * The display name will be formatted as "value1 | value2 | ..." for help output.
 *
 * @param values - Array of allowed string values
 * @returns A TypeFunction that validates and returns the input value
 * @throws {Error} If the value is not in the allowed values list
 *
 * @example
 * ```typescript
 * const format = Enum(['json', 'yaml', 'xml']);
 * // Help output will show: json | yaml | xml
 * ```
 */
export function Enum<T extends string>(...values: T[]): TypeFunction<T> {
	const fn = ((value: string) => {
		if (!values.includes(value as any)) {
			throw new Error(
				`Invalid value: ${value}. Must be one of: ${values.join(", ")}`,
			);
		}

		return value;
	}) as TypeFunction<T>;

	fn.display = values.join(" | ");

	return fn;
}

/**
 * Creates a range type function that validates the input is a number within the specified range.
 *
 * @param min - The minimum acceptable value (inclusive)
 * @param max - The maximum acceptable value (inclusive)
 * @returns A TypeFunction that validates the input value
 * @throws {Error} If the value is not a number or is outside the specified range
 */
export function Range(min: number, max: number): TypeFunction<number> {
	const fn = ((value: string) => {
		const num = Number(value);
		if (Number.isNaN(num) || num < min || num > max) {
			throw new Error(
				`Invalid value: ${value}. Must be a number between ${min} and ${max}`,
			);
		}

		return num;
	}) as TypeFunction<number>;
	fn.display = `${min} - ${max}`;

	return fn;
}

/**
 * Creates a regex type function that validates the input against the provided pattern.
 *
 * @param pattern - The regular expression pattern to validate against
 * @param description - Optional description for display purposes
 * @returns A TypeFunction that validates the input value
 * @throws {Error} If the value does not match the regex pattern
 */
export function Regex(
	pattern: RegExp,
	description?: string,
): TypeFunction<string> {
	const fn = ((value: string) => {
		if (!pattern.test(value)) {
			throw new Error(
				`Invalid value: ${value}. Must match pattern: ${pattern}`,
			);
		}

		return value;
	}) as TypeFunction<string>;
	fn.display = description ?? `Regex: ${pattern.toString()}`;

	return fn;
}
