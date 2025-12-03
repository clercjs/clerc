import type { FLAG, PARAMETER } from "./iterator";

type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export type FlagDefaultValue<T> = T | (() => T);

/**
 * Base options for a flag.
 * @template T The type of the parsed value.
 */
export interface BaseFlagOptions<T> {
	/** Aliases for the flag. */
	alias?: string | string[];
	/** The default value of the flag. */
	default?: FlagDefaultValue<T>;
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
export type FlagTypeFunction<T> = (value: string) => T;

export type FlagType<T> = FlagTypeFunction<T> | [FlagTypeFunction<T>];

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
	type: FlagType<T>;
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
export type FlagOptions<T = any> =
	| BooleanFlagOptions
	| ObjectFlagOptions
	| GeneralFlagOptions<T>;

/**
 * The value type for each property in the `flags` object, which can be a full configuration object or a shorthand syntax.
 */
export type FlagOptionsValue<T = any> = FlagOptions | FlagType<T>;

export type FlagsConfigSchema = Record<string, FlagOptionsValue>;

/**
 * A callback function to conditionally stop parsing.
 * When it returns true, parsing stops and remaining arguments are preserved in `ignored`.
 * @param type - The type of the current argument: 'flag' for flags, 'parameter' for positional arguments
 * @param arg - The current argument being processed
 * @returns true to stop parsing, false to continue
 */
export type IgnoreFunction = (
	type: typeof FLAG | typeof PARAMETER,
	arg: string,
) => boolean;

/**
 * Configuration options for the parser.
 */
export interface ParserOptions<T extends FlagsConfigSchema = {}> {
	/**
	 * Detailed configuration for flags.
	 * Supports the full object syntax or a type constructor as a shorthand.
	 * The key is the flag name (e.g., "file" for "--file").
	 */
	flags?: T;

	/**
	 * Delimiters to split flag names and values.
	 * @default ['=', ':']
	 */
	delimiters?: string[];

	/**
	 * A callback function to conditionally stop parsing.
	 * When it returns true, parsing stops and remaining arguments are preserved in `ignored`.
	 */
	ignore?: IgnoreFunction;
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
	/** Arguments that were not parsed due to ignore callback. */
	ignored: string[];
}

/**
 * Extracts the final return value type from a FlagType (e.g., String, Number, or a custom function).
 */
type GetValueType<T> = T extends FlagTypeFunction<infer U> ? U : any;

/**
 * A utility type that represents the shape of a flag type specification.
 */
export type FlagTypeSpec<T> = T | { type: T };

type _InferFlags<T extends FlagsConfigSchema> = {
	[K in keyof T]: T[K] extends FlagTypeSpec<BooleanConstructor>
		? boolean
		: T[K] extends FlagTypeSpec<[BooleanConstructor]>
			? number
			: T[K] extends FlagTypeSpec<ObjectConstructor>
				? Record<string, RawInputType>
				: T[K] extends FlagTypeSpec<[infer U]>
					? GetValueType<U>[]
					: T[K] extends FlagTypeSpec<infer U>
						? T[K] extends { default: any }
							? GetValueType<U>
							: GetValueType<U> | undefined
						: any;
};

/**
 * An advanced utility type that infers the exact type of the `flags` object in the parsed result,
 * based on the provided `flags` configuration object T.
 * @template T The type of the flags configuration object.
 */
export type InferFlags<T extends FlagsConfigSchema> = Prettify<_InferFlags<T>>;

export type PartialRequired<T, K extends keyof T> = T & {
	[P in K]-?: T[P];
};
