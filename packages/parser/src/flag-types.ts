import type { FlagTypeFunction } from "@clerc/parser";

/**
 * Creates a Enum type function that validates the input against allowed values.
 * The display name will be formatted as "value1 | value2 | ..." for help output.
 *
 * @param values - Array of allowed string values
 * @returns A FlagTypeFunction that validates and returns the input value
 * @throws {Error} If the value is not in the allowed values list
 *
 * @example
 * ```typescript
 * const format = Enum(['json', 'yaml', 'xml']);
 * // Help output will show: json | yaml | xml
 * ```
 */
export function Enum<T extends string>(...values: T[]): FlagTypeFunction<T> {
	const fn = ((value: string) => {
		if (!values.includes(value as any)) {
			throw new Error(
				`Invalid value: ${value}. Must be one of: ${values.join(", ")}`,
			);
		}

		return value;
	}) as FlagTypeFunction<T>;

	fn.display = values.join(" | ");

	return fn;
}
