import type { ClercFlagsDefinition, CommandWithHandler } from "./types";

export const defineCommand = <
	Name extends string,
	Parameters extends string[] = [],
	Flags extends ClercFlagsDefinition = {},
>(
	command: CommandWithHandler<Name, [...Parameters], Flags>,
): CommandWithHandler<Name, [...Parameters], Flags> => command;
