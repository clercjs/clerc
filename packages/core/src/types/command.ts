import type { IgnoreFunction } from "@clerc/parser";
import type { MaybeArray } from "@clerc/utils";

import type { ClercFlagsDefinition } from "./clerc";
import type { HandlerContext } from "./context";

// TODO: runtime code
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
	[K in keyof Commands]: [HandlerContext<Commands[K]>];
};
