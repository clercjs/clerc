import type {
	ClercFlagsDefinition,
	Command,
	CommandHandler,
	CommandWithHandler,
} from "./types";

export const defineCommand = <
	Name extends string,
	Parameters extends readonly string[] = readonly [],
	Flags extends ClercFlagsDefinition = {},
>(
	command: Command<Name, [...Parameters], Flags>,
	handler?: NoInfer<CommandHandler<Command<Name, Parameters, Flags>>>,
): CommandWithHandler<Name, Parameters, Flags> => ({ ...command, handler });
