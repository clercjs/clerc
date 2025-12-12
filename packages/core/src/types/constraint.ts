/**
 * Creates an enum constraint function that validates the input against a set of allowed values.
 *
 * @template T - The union type of allowed string values. Just a marker type to help with inference.
 */
// eslint-disable-next-line unused-imports/no-unused-vars
export interface ConstraintFunction<T = string> {
	(value: string): void;
	display?: string;
}
