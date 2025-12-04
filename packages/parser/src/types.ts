import type { ExclusifyUnion } from "type-fest";

import type { FLAG, PARAMETER } from "./iterator";

type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export type FlagDefaultValue<T = unknown> = T | (() => T);

/**
 * Defines how a string input is converted to the target type T.
 *
 * @template T The target type.
 */
export type FlagTypeFunction<T = unknown> = (value: string) => T;

/**
 * A callback function to conditionally stop parsing.
 * When it returns true, parsing stops and remaining arguments are preserved in `ignored`.
 *
 * @param type - The type of the current argument: 'flag' for flags, 'parameter' for positional arguments
 * @param arg - The current argument being processed
 * @returns true to stop parsing, false to continue
 */
export type IgnoreFunction = (
	type: typeof FLAG | typeof PARAMETER,
	arg: string,
) => boolean;

export type FlagType<T = unknown> =
	| FlagTypeFunction<T>
	| readonly [FlagTypeFunction<T>];

export interface BaseFlagOptions<T extends FlagType = FlagType> {
	/**
	 * The type constructor or a function to convert the string value.
	 * To support multiple occurrences of a flag (e.g., --file a --file b), wrap the type in an array: [String], [Number].
	 * e.g., String, Number, [String], (val) => val.split(',')
	 */
	type: T;
	/** Aliases for the flag. */
	alias?: string | string[];
	/** The default value of the flag. */
	default?: unknown;
}
export interface BooleanFlagOptions extends BaseFlagOptions<BooleanConstructor> {
	/**
	 * Whether to enable the `--no-<flag>` syntax to set the value to false.
	 * Only useful for boolean flags.
	 * When set on a non-boolean flag, a type error will be shown.
	 *
	 * @default true
	 */
	negatable?: boolean;
}
export type FlagOptions = ExclusifyUnion<BaseFlagOptions | BooleanFlagOptions>;
export type FlagDefinitionValue = FlagOptions | FlagType;
export type FlagsDefinition = Record<string, FlagDefinitionValue>;

/**
 * Configuration options for the parser.
 */
export interface ParserOptions<T extends FlagsDefinition = {}> {
	/**
	 * Detailed configuration for flags.
	 * Supports the full object syntax or a type constructor as a shorthand.
	 * The key is the flag name (e.g., "file" for "--file").
	 */
	flags?: T;

	/**
	 * Delimiters to split flag names and values.
	 *
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

type InferFlagDefault<T extends FlagDefinitionValue, Fallback> = T extends {
	default: FlagDefaultValue<infer DefaultType>;
}
	? DefaultType
	: Fallback;

type _InferFlags<T extends FlagsDefinition> = {
	[K in keyof T]: T[K] extends
		| readonly [BooleanConstructor]
		| { type: readonly [BooleanConstructor] }
		? number
		: T[K] extends ObjectConstructor | { type: ObjectConstructor }
			? Record<string, RawInputType>
			: T[K] extends
						| readonly [FlagType<infer U>]
						| { type: readonly [FlagType<infer U>] }
				? U[] | InferFlagDefault<T[K], never>
				: T[K] extends FlagType<infer U> | { type: FlagType<infer U> }
					?
							| U
							| InferFlagDefault<
									T[K],
									[U] extends [boolean] ? never : undefined
							  >
					: never;
};

/**
 * An advanced utility type that infers the exact type of the `flags` object in the parsed result,
 * based on the provided `flags` configuration object T.
 *
 * @template T The type of the flags configuration object.
 */
export type InferFlags<T extends FlagsDefinition> = Prettify<_InferFlags<T>>;

export type PartialRequired<T, K extends keyof T> = T & {
	[P in K]-?: T[P];
};
