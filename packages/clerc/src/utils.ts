import { isDeno, isNode } from "is-platform";
import type { Dict } from "@clerc/utils";
import { arrayStartsWith, kebabCase, mustArray } from "@clerc/utils";

import type { SingleCommandType } from "./cli";
import { SingleCommand } from "./cli";
import type { Command, CommandRecord, FlagOptions, Inspector, InspectorContext } from "./types";

export const resolveFlagAlias = (_command: Command) =>
  Object.entries(_command?.flags || {}).reduce((acc, [name, command]) => {
    if (command.alias) {
      const item = mustArray(command.alias).map(kebabCase);
      acc[kebabCase(name)] = item;
    }
    return acc;
  }, {} as Dict<string[]>);

export const resolveFlagDefault = (_command: Command) =>
  Object.entries(_command?.flags || {}).reduce((acc, [name, command]) => {
    const item = command.default;
    if (item) {
      acc[name] = item;
    }
    return acc;
  }, {} as Dict<FlagOptions["default"]>);

export function resolveCommand (commands: CommandRecord, name: string | string[] | SingleCommandType): Command | undefined {
  if (name === SingleCommand) {
    return commands[SingleCommand];
  }
  const nameArr = Array.isArray(name) ? name : name.split(" ");
  const nameString = nameArr.join(" ");
  const possibleCommands = Object.values(commands)
    .filter(c => arrayStartsWith(nameArr, c.name.split(" ")) || mustArray(c.alias || [])
      .map(String)
      .includes(nameString),
    );
  if (possibleCommands.length > 1) {
    throw new Error(`Multiple commands found with name "${nameString}"`);
  }
  return possibleCommands[0];
}

export function resolveSubcommandsByParent (commands: CommandRecord, parent: string | string[], depth = Infinity) {
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

export function resolveParametersBeforeFlag (argv: string[]) {
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

export function compose (inspectors: Inspector[]) {
  return (getCtx: () => InspectorContext) => {
    return dispatch(0);
    function dispatch (i: number): void {
      const inspector = inspectors[i];
      return inspector(getCtx(), dispatch.bind(null, i + 1));
    }
  };
}
