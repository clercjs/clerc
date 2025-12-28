import type {
  ClercFlagsDefinition,
  Command,
  CommandHandler,
  CommandWithHandler,
  ParameterDefinitionValue,
} from "./types";

export const defineCommand = <
  Name extends string,
  const Parameters extends readonly ParameterDefinitionValue[],
  Flags extends ClercFlagsDefinition,
>(
  command: Command<Name, Parameters, Flags>,
  handler?: NoInfer<CommandHandler<Command<Name, Parameters, Flags>>>,
): CommandWithHandler<Name, Parameters, Flags> => ({ ...command, handler });
