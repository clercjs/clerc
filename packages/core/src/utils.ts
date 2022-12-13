import { isDeno, isNode } from "is-platform";
import { arrayStartsWith, mustArray } from "@clerc/utils";

import type { SingleCommandType } from "./cli";
import { SingleCommand } from "./cli";
import type { Command, CommandAlias, CommandRecord, Inspector, InspectorContext } from "./types";
import { CommandNameConflictError, MultipleCommandsMatchedError } from "./errors";

export function resolveFlattenCommands(commands: CommandRecord) {
  const commandsMap = new Map<string[], CommandAlias>();
  for (const command of Object.values(commands)) {
    if (command.alias) {
      const aliases = mustArray(command.alias);
      for (const alias of aliases) {
        if (alias in commands) {
          throw new CommandNameConflictError(commands[alias].name, command.name);
        }
        commandsMap.set(alias.split(" "), { ...command, __isAlias: true });
      }
    }
    commandsMap.set(command.name.split(" "), command);
  }
  return commandsMap;
}

export function resolveCommand(commands: CommandRecord, name: string | string[] | SingleCommandType): Command | undefined {
  if (name === SingleCommand) {
    return commands[SingleCommand];
  }
  const nameArr = mustArray(name) as string[];
  const commandsMap = resolveFlattenCommands(commands);
  const possibleCommands: Command[] = [];
  commandsMap.forEach((v, k) => {
    if (arrayStartsWith(nameArr, k)) {
      possibleCommands.push(v);
    }
  });
  if (possibleCommands.length > 1) {
    const matchedCommandNames = possibleCommands.map(c => c.name).join(", ");
    throw new MultipleCommandsMatchedError(matchedCommandNames);
  }
  return possibleCommands[0];
}

export function resolveSubcommandsByParent(commands: CommandRecord, parent: string | string[], depth = Infinity) {
  const parentArr = parent === ""
    ? []
    : Array.isArray(parent)
      ? parent
      : parent.split(" ");
  return Object.values(commands)
    .filter((c) => {
      const commandNameArr = c.name.split(" ");
      return arrayStartsWith(commandNameArr, parentArr) && commandNameArr.length - parentArr.length <= depth;
    });
}

export const resolveRootCommands = (commands: CommandRecord) => resolveSubcommandsByParent(commands, "", 1);

export function resolveParametersBeforeFlag(argv: string[], isSingleCommand: boolean) {
  if (isSingleCommand) {
    return [];
  }
  const parameters = [];
  for (const arg of argv) {
    if (arg.startsWith("-")) {
      break;
    }
    parameters.push(arg);
  }
  return parameters;
}

export const resolveArgv = (): string[] =>
  isNode()
    ? process.argv.slice(2)
    : isDeno()
      // @ts-expect-error Ignore
      ? Deno.args
      : [];

export function compose(inspectors: Inspector[]) {
  return (getCtx: () => InspectorContext) => {
    return dispatch(0);
    function dispatch(i: number): void {
      const inspector = inspectors[i];
      return inspector(getCtx(), dispatch.bind(null, i + 1));
    }
  };
}
