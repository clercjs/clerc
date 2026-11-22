import type { IgnoreFunction } from "@clerc/parser";
import { PARAMETER } from "@clerc/parser";

import type {
  ClercFlagsDefinition,
  ClercPlugin,
  CommandDefinition,
  CommandHandler,
  ParameterDefinitionValue,
} from "./types";

export const defineCommand = <
  const Name extends string,
  const Parameters extends readonly ParameterDefinitionValue[] =
    readonly ParameterDefinitionValue[],
  const Flags extends ClercFlagsDefinition = {},
>(
  definition: CommandDefinition<Name, Parameters, Flags>,
  run?: CommandHandler<NoInfer<Parameters>, NoInfer<Flags>>,
): CommandDefinition<Name, Parameters, Flags> =>
  run ? { ...definition, run } : definition;

export const definePlugin = <
  TGlobalFlags extends ClercFlagsDefinition = {},
  TExt extends Record<string, any> = {},
>(
  plugin: ClercPlugin<TGlobalFlags, TExt>,
): ClercPlugin<TGlobalFlags, TExt> => plugin;

export function createStopAtFirstParameter(): IgnoreFunction {
  let encounteredParameter = false;

  return (type) => {
    if (type === PARAMETER && !encounteredParameter) {
      encounteredParameter = true;

      return false;
    }

    return encounteredParameter;
  };
}
