import type { IgnoreFunction } from "@clerc/parser";
import type { DeepPrettify, MaybeArray, PartialRequired } from "@clerc/utils";

import type { BaseContext } from "./context";
import type { ClercFlagsDefinition } from "./flag";
import type { ParameterDefinitionValue } from "./parameter";

export declare interface CommandCustomOptions {}

export interface CommandOptions<
	Parameters extends readonly ParameterDefinitionValue[] =
		readonly ParameterDefinitionValue[],
	Flags extends ClercFlagsDefinition = ClercFlagsDefinition,
> extends CommandCustomOptions {
	alias?: MaybeArray<string>;
	parameters?: Parameters;
	flags?: Flags;

	/**
	 * A callback function to conditionally stop parsing. When it returns true,
	 * parsing stops and remaining arguments are preserved in ignored.
	 */
	ignore?: IgnoreFunction;
}

export interface Command<
	Name extends string = string,
	Parameters extends readonly ParameterDefinitionValue[] =
		readonly ParameterDefinitionValue[],
	Flags extends ClercFlagsDefinition = ClercFlagsDefinition,
> extends CommandOptions<Parameters, Flags> {
	name: Name;
	description?: string;
}

export type CommandWithHandler<
	Name extends string = string,
	Parameters extends readonly ParameterDefinitionValue[] =
		readonly ParameterDefinitionValue[],
	Flags extends ClercFlagsDefinition = ClercFlagsDefinition,
> = Command<Name, Parameters, Flags> & {
	handler?: CommandHandler<Command<Name, Parameters, Flags>>;
};

export type CommandsRecord = Record<string, Command>;
export type CommandsMap = Map<string, Command>;
export type MakeEmitterEvents<
	Commands extends CommandsRecord,
	GlobalFlags extends ClercFlagsDefinition = ClercFlagsDefinition,
> = {
	[K in keyof Commands]: [CommandHandlerContext<Commands[K], GlobalFlags>];
};

export type CommandHandlerContext<
	C extends Command = Command,
	GF extends ClercFlagsDefinition = ClercFlagsDefinition,
> = DeepPrettify<
	PartialRequired<BaseContext<C, GF>, "command" | "calledAs"> & {
		resolved: true;
	}
>;
export type CommandHandler<
	C extends Command = Command,
	GF extends ClercFlagsDefinition = ClercFlagsDefinition,
> = (context: CommandHandlerContext<C, GF>) => void;
