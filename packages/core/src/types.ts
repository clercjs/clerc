import type {
	FlagOptions,
	FlagType,
	IgnoreFunction,
	InferFlags,
	ParsedResult,
} from "@clerc/parser";
import type { MaybeArray } from "@clerc/utils";

export type ParsingMode = "all" | "stop-at-positional" | "custom";

export interface CommandOptions<Parameters extends string[] = string[]> {
	alias?: MaybeArray<string>;
	parameters?: Parameters;
	flags?: ClercFlagsDefinition;

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
	Parameters extends string[] = string[],
> extends CommandOptions<Parameters> {
	name: string;
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
	T extends undefined ? {} : InferFlags<NonNullable<T>>;

export type Context<C extends Command> = {
	command: Command;
	calledAs: string;
} & ParsedResult<InferFlagsFromMaybeUndefined<C["flags"]>>;
