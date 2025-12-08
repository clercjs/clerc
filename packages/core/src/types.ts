import type {
	FlagOptions,
	FlagType,
	IgnoreFunction,
	InferFlags,
	ParsedResult,
} from "@clerc/parser";
import type { MaybeArray } from "@clerc/utils";

export type ParsingMode = "all" | "stop-at-positional" | "custom";

export interface CommandOptions<
	Parameters extends string[] = string[],
	Flags extends ClercFlagsDefinition = {},
> {
	alias?: MaybeArray<string>;
	parameters?: Parameters;
	flags?: Flags;

	/**
	 * @default "all"
	 */
	mode?: ParsingMode;
	/**
	 * A callback function to conditionally stop parsing. When it returns true, parsing stops and remaining arguments are preserved in ignored.
	 * Only used when mode is set to "custom".
	 */
	ignore?: IgnoreFunction;
}

export interface Command<
	Name extends string = string,
	Parameters extends string[] = string[],
	Flags extends ClercFlagsDefinition = {},
> extends CommandOptions<Parameters, Flags> {
	name: Name;
	description: string;
}

export type CommandsRecord = Record<string, Command>;
export type CommandsMap = Map<string, Command>;
export type MakeEmitterEvents<Commands extends CommandsRecord> = {
	[K in keyof Commands]: [Context<Commands[K]>];
};

export type ClercFlagOptions = FlagOptions & {
	description: string;
};
export type ClercFlagDefinitionValue = ClercFlagOptions | FlagType;
export type ClercFlagsDefinition = Record<string, ClercFlagDefinitionValue>;

type InferFlagsFromMaybeUndefined<T extends ClercFlagsDefinition | undefined> =
	T extends undefined ? never : InferFlags<NonNullable<T>>;

export type Context<C extends Command> = {
	command: C;
	calledAs: string;
} & ParsedResult<InferFlagsFromMaybeUndefined<C["flags"]>>;
