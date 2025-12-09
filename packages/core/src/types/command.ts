import type { IgnoreFunction } from "@clerc/parser";
import type { DeepPrettify, MaybeArray, PartialRequired } from "@clerc/utils";

import type { ClercFlagsDefinition } from "./clerc";
import type { BaseContext } from "./context";

export declare interface CommandCustomOptions {}

export interface CommandOptions<
	Parameters extends string[] = string[],
	Flags extends ClercFlagsDefinition = {},
> extends CommandCustomOptions {
	alias?: MaybeArray<string>;
	parameters?: Parameters;
	flags?: Flags;

	/**
	 * A callback function to conditionally stop parsing. When it returns true, parsing stops and remaining arguments are preserved in ignored.
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

export type CommandWithHandler<
	Name extends string = string,
	Parameters extends string[] = string[],
	Flags extends ClercFlagsDefinition = {},
> = Command<Name, Parameters, Flags> & {
	handler?: CommandHandler<Command<Name, Parameters, Flags>>;
};

export type CommandsRecord = Record<string, Command>;
export type CommandsMap = Map<string, Command>;
export type MakeEmitterEvents<Commands extends CommandsRecord> = {
	[K in keyof Commands]: [CommandHandlerContext<Commands[K]>];
};

export type CommandHandlerContext<C extends Command> = DeepPrettify<
	PartialRequired<BaseContext<C>, "command" | "calledAs"> & {
		resolved: true;
	}
>;
export type CommandHandler<C extends Command = Command> = (
	context: CommandHandlerContext<C>,
) => void;
