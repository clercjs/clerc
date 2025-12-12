import type { ConstraintFunction } from "./types/constraint";

/**
 * Creates an enum constraint function that validates the input against a set of allowed values.
 *
 * @param values - Array of allowed string values
 * @returns A ConstraintFunction that validates the input value
 * @throws {Error} If the value is not in the allowed values list
 */
export function Enum<T extends string>(...values: T[]): ConstraintFunction<T> {
	function fn(value: string) {
		if (!values.includes(value as any)) {
			throw new Error(
				`Invalid value: ${value}. Must be one of: ${values.join(", ")}`,
			);
		}
	}
	fn.display = values.join(" | ");

	return fn;
}

/**
 * Creates a range constraint function that validates the input is a number within the specified range.
 *
 * @param min - The minimum acceptable value (inclusive)
 * @param max - The maximum acceptable value (inclusive)
 * @returns A ConstraintFunction that validates the input value
 * @throws {Error} If the value is not a number or is outside the specified range
 */
export function Range(min: number, max: number): ConstraintFunction {
	function fn(value: string) {
		const num = Number(value);
		if (Number.isNaN(num) || num < min || num > max) {
			throw new Error(
				`Invalid value: ${value}. Must be a number between ${min} and ${max}`,
			);
		}
	}
	fn.display = `${min}-${max}`;

	return fn;
}

/**
 * Creates a regex constraint function that validates the input against the provided pattern.
 *
 * @param pattern - The regular expression pattern to validate against
 * @param description - Optional description for display purposes
 * @returns A ConstraintFunction that validates the input value
 * @throws {Error} If the value does not match the regex pattern
 */
export function Regex(
	pattern: RegExp,
	description?: string,
): ConstraintFunction {
	function fn(value: string) {
		if (!pattern.test(value)) {
			throw new Error(
				`Invalid value: ${value}. Must match pattern: ${pattern}`,
			);
		}
	}
	fn.display = description ?? pattern.toString();

	return fn;
}

/**
 * Just an utility to create custom constraints, helps you set the display name.
 *
 * @param validator - A function that validates the input value. Should return true if valid, false or throw an error if invalid.
 * @param display - Optional display name for the constraint, useful in help output.
 * @param errorMessage - Optional function to generate a custom error message when validation fails.
 * @returns A ConstraintFunction that applies the custom validation logic.
 * @throws {Error} If the validator returns false or throws an error.
 */
export function Custom(
	validator: (value: string) => boolean | void,
	display?: string,
	errorMessage?: (value: string) => string,
): ConstraintFunction {
	function fn(value: string) {
		const result = validator(value);
		if (result === false) {
			throw new Error(
				errorMessage ? errorMessage(value) : `Invalid value: ${value}`,
			);
		}
	}
	fn.display = display;

	return fn;
}
