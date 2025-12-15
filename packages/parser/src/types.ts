import type { IsAny, Prettify, RequireExactlyOneOrNone } from "@clerc/utils";

import type { KNOWN_FLAG, PARAMETER, UNKNOWN_FLAG } from "./iterator";

export interface FlagDefaultValueFunction<T> {
	(): T;
	display?: string;
}

export type FlagDefaultValue<T = unknown> = T | FlagDefaultValueFunction<T>;

/**
 * Defines how a string input is converted to the target type T.
 *
 * @template T The target type.
 */
export interface TypeFunction<T = unknown> {
	(value: string): T;
	/**
	 * Optional display name for the type, useful in help output.
	 * If provided, this will be shown instead of the function name.
	 */
	display?: string;
}

/**
 * A callback function to conditionally stop parsing.
 * When it returns true, parsing stops and remaining arguments are preserved in `ignored`.
 *
 * @param type - The type of the current argument: 'known-flag' or 'unknown-flag' for flags, 'parameter' for positional arguments
 * @param arg - The current argument being processed
 * @returns true to stop parsing, false to continue
 */
export type IgnoreFunction = (
	type: typeof KNOWN_FLAG | typeof UNKNOWN_FLAG | typeof PARAMETER,
	arg: string,
) => boolean;

export type TypeValue<T = unknown> =
	| TypeFunction<T>
	| readonly [TypeFunction<T>];

type FlagRequiredOrDefault = RequireExactlyOneOrNone<
	{
		/** The default value of the flag. */
		default?: unknown;
		/** Whether the flag is required. */
		required?: boolean;
	},
	"default" | "required"
>;

export type BaseFlagOptions<T extends TypeValue = TypeValue> =
	FlagRequiredOrDefault & {
		/**
		 * The type constructor or a function to convert the string value.
		 * To support multiple occurrences of a flag (e.g., --file a --file b), wrap the type in an array: [String], [Number].
		 * e.g., String, Number, [String], (val) => val.split(',')
		 */
		type: T;
		/** Short flag alias (single character). */
		short?: string;
	};
export type FlagOptions =
	| (BaseFlagOptions<BooleanConstructor> & {
			/**
			 * Whether to enable the `--no-<flag>` syntax to set the value to false.
			 * Only useful for boolean flags.
			 * When set on a non-boolean flag, a type error will be shown.
			 *
			 * @default true
			 */
			negatable?: boolean;
	  })
	| (BaseFlagOptions & {
			negatable?: never;
	  });
export type FlagDefinitionValue = FlagOptions | TypeValue;
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
export interface ObjectInputType {
	[key: string]: RawInputType | ObjectInputType;
}

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
	/** List of required flags that were not provided. */
	missingRequiredFlags: string[];
}

type InferFlagDefault<T extends FlagDefinitionValue, Fallback> = T extends {
	default: FlagDefaultValue<infer DefaultType>;
}
	? DefaultType
	: Fallback;

type IsTypeAny<T extends FlagDefinitionValue> =
	IsAny<T> extends true
		? true
		: T extends { type: infer Type }
			? IsAny<Type> extends true
				? true
				: false
			: false;

type _InferFlags<T extends FlagsDefinition> = {
	[K in keyof T]: IsTypeAny<T[K]> extends true
		? any
		: T[K] extends
					| readonly [BooleanConstructor]
					| { type: readonly [BooleanConstructor] }
			? number | InferFlagDefault<T[K], never>
			: T[K] extends ObjectConstructor | { type: ObjectConstructor }
				? ObjectInputType | InferFlagDefault<T[K], never>
				: T[K] extends
							| readonly [TypeValue<infer U>]
							| { type: readonly [TypeValue<infer U>] }
					? U[] | InferFlagDefault<T[K], never>
					: T[K] extends TypeValue<infer U> | { type: TypeValue<infer U> }
						?
								| U
								| InferFlagDefault<
										T[K],
										[U] extends [boolean]
											? never
											: T[K] extends { required: true }
												? never
												: undefined
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
