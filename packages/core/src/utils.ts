import { isDeno, isNode } from "is-platform";
import { arrayStartsWith, toArray } from "@clerc/utils";

import type { SingleCommandType } from "./cli";
import { SingleCommand } from "./cli";
import type { Command, CommandAlias, CommandRecord, CommandType, Inspector, InspectorContext, InspectorFn, InspectorObject } from "./types";
import { CommandNameConflictError } from "./errors";

export function resolveFlattenCommands(commands: CommandRecord) {
  const commandsMap = new Map<string[] | SingleCommandType, CommandAlias>();
  if (commands[SingleCommand]) {
    commandsMap.set(SingleCommand, commands[SingleCommand]);
  }
  for (const command of Object.values(commands)) {
    if (command.alias) {
      const aliases = toArray(command.alias);
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

export function resolveCommand(commands: CommandRecord, name: string | string[] | SingleCommandType): Command<string | SingleCommandType> | undefined {
  if (name === SingleCommand) { return commands[SingleCommand]; }
  const nameArr = toArray(name) as string[];
  const commandsMap = resolveFlattenCommands(commands);
  let current: Command | undefined;
  let currentName: string[] | SingleCommandType | undefined;
  // Logic:
  // Imagine we have to commands: `foo` and `foo bar`
  // If the given argv starts with `foo bar`, we return `foo bar`.
  // But if the given argv starts with `foo baz`, we return `foo`.
  // Just simply compare their length, longer is better =)
  if (nameArr.length === 0) {
    current = commandsMap.get(SingleCommand);
    currentName = SingleCommand;
    commandsMap.delete(SingleCommand);
  }

  commandsMap.forEach((v, _k) => {
    const k = _k as string[];
    if (arrayStartsWith(nameArr, k) && (!currentName || currentName === SingleCommand || k.length > currentName.length)) {
      current = v;
      currentName = k;
    }
  });

  return current;
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

export function resolveParametersBeforeFlag(argv: string[]) {
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
  const preInspectors: InspectorFn[] = [];
  const normalInspectors: InspectorFn[] = [];
  const postInspectors: InspectorFn[] = [];
  for (const inspector of inspectors) {
    const objectInspector: InspectorObject = typeof inspector === "object"
      ? inspector
      : { fn: inspector };
    const { enforce } = objectInspector;
    (enforce === "pre"
      ? preInspectors
      : enforce === "post"
        ? postInspectors
        : normalInspectors).push(objectInspector.fn);
  }

  const mergedInspectorFns = [
    ...preInspectors,
    ...normalInspectors,
    ...postInspectors,
  ];
  return (getCtx: () => InspectorContext) => {
    return dispatch(0);
    function dispatch(i: number): void {
      const inspector = mergedInspectorFns[i];
      return inspector(getCtx(), dispatch.bind(null, i + 1));
    }
  };
}

export const isInvalidName = (name: CommandType) => typeof name === "string" && (name.startsWith(" ") || name.endsWith(" "));
