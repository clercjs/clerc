type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

/**
 * Base options for a flag.
 * @template T The type of the parsed value.
 */
export interface BaseFlagOptions<T> {
	/** Aliases for the flag. */
	alias?: string | string[];
	/** The default value of the flag. */
	default?: T;
}

/**
 * Specific options for a boolean flag.
 */
export interface BooleanFlagOptions extends BaseFlagOptions<boolean> {
	/** The type must be the Boolean constructor. */
	type: BooleanConstructor;
	/**
	 * Whether to enable the `--no-<flag>` syntax to set the value to false.
	 * @default true
	 */
	negatable?: boolean;
}

/**
 * Defines how a string input is converted to the target type T.
 * @template T The target type.
 */
export type FlagType<T> = (value: string) => T;

/**
 * Options for a general-purpose flag.
 * @template T The type of the parsed value (or the element type if it's an array).
 */
export interface GeneralFlagOptions<T> extends BaseFlagOptions<T | T[]> {
	/**
	 * The type constructor or a function to convert the string value.
	 * To support multiple occurrences of a flag (e.g., --file a --file b), wrap the type in an array: [String], [Number].
	 * e.g., String, Number, [String], (val) => val.split(',')
	 */
	type: FlagType<T> | [FlagType<T>];
}

/**
 * Specific options for an object flag to support dot-notation.
 */
export interface ObjectFlagOptions extends BaseFlagOptions<
	Record<string, any>
> {
	/** The type must be the Object constructor. */
	type: ObjectConstructor;
}

/**
 * A union type representing all possible flag configurations.
 */
export type FlagOptions =
	| BooleanFlagOptions
	| ObjectFlagOptions
	| GeneralFlagOptions<any>;

/**
 * The value type for each property in the `flags` object, which can be a full configuration object or a shorthand syntax.
 */
export type FlagOptionsValue = FlagOptions | FlagType<any> | [FlagType<any>];

/**
 * Configuration options for the parser.
 */
export interface ParserOptions<
	T extends Record<string, FlagOptionsValue> = {},
> {
	/**
	 * Detailed configuration for flags.
	 * Supports the full object syntax or a type constructor as a shorthand.
	 * The key is the flag name (e.g., "file" for "--file").
	 */
	flags?: T;
}

export type RawInputType = string | boolean;

/**
 * The parsed result.
 * @template TFlags The specific flags type inferred from ParserOptions.
 */
export interface ParsedResult<TFlags extends Record<string, any>> {
	/** Positional arguments or commands. */
	parameters: string[];
	/** Arguments after the `--` delimiter. */
	doubleDash: string[];
	/**
	 * The parsed flags.
	 * This is a strongly-typed object whose structure is inferred from the `flags` configuration in ParserOptions.
	 */
	flags: TFlags;
	/** The raw command-line arguments. */
	raw: string[];
	/** Unknown flags encountered during parsing. */
	unknown: Record<string, RawInputType>;
}

/**
 * Extracts the final return value type from a FlagType (e.g., String, Number, or a custom function).
 */
type GetValueType<T> = T extends (value: string) => infer R
	? R
	: T extends new (...args: any[]) => infer R
		? R
		: any;

type _InferFlags<T extends Record<string, FlagOptionsValue>> = {
	[K in keyof T]: T[K] extends BooleanConstructor | { type: BooleanConstructor }
		? boolean
		: T[K] extends BooleanConstructor[] | { type: BooleanConstructor[] }
			? never
			: T[K] extends ObjectConstructor | { type: ObjectConstructor }
				? Record<string, RawInputType>
				: T[K] extends [infer U] | { type: [infer U] }
					? GetValueType<U>[]
					: T[K] extends infer U | { type: infer U }
						? GetValueType<U>
						: any;
};

/**
 * An advanced utility type that infers the exact type of the `flags` object in the parsed result,
 * based on the provided `flags` configuration object T.
 * @template T The type of the flags configuration object.
 */
export type InferFlags<T extends Record<string, FlagOptionsValue>> = Prettify<
	_InferFlags<T>
>;
