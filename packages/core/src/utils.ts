import { isDeno, isNode } from "is-platform";
import { arrayStartsWith, toArray } from "@clerc/utils";

import type { RootType } from "./cli";
import { Root } from "./cli";
import type { Command, CommandAlias, CommandRecord, CommandType, Inspector, InspectorContext, InspectorFn, InspectorObject } from "./types";
import { CommandNameConflictError } from "./errors";

function setCommand(commandsMap: Map<string[] | RootType, CommandAlias>, commands: CommandRecord, command: Command) {
  if (command.alias) {
    const aliases = toArray(command.alias);
    for (const alias of aliases) {
      if (alias in commands) {
        throw new CommandNameConflictError(commands[alias]!.name, command.name);
      }
      commandsMap.set(typeof alias === "symbol" ? alias : alias.split(" "), { ...command, __isAlias: true });
    }
  }
}

export function resolveFlattenCommands(commands: CommandRecord) {
  const commandsMap = new Map<string[] | RootType, CommandAlias>();
  if (commands[Root]) {
    commandsMap.set(Root, commands[Root]);
    setCommand(commandsMap, commands, commands[Root]);
  }
  for (const command of Object.values(commands)) {
    setCommand(commandsMap, commands, command);
    commandsMap.set(command.name.split(" "), command);
  }
  return commandsMap;
}

export function resolveCommand(commands: CommandRecord, name: string | string[] | RootType): Command<string | RootType> | undefined {
  if (name === Root) { return commands[Root]; }
  const nameArr = toArray(name) as string[];
  const commandsMap = resolveFlattenCommands(commands);
  let current: Command | undefined;
  let currentName: string[] | RootType | undefined;
  // Logic:
  // Imagine we have to commands: `foo` and `foo bar`
  // If the given argv starts with `foo bar`, we return `foo bar`.
  // But if the given argv starts with `foo baz`, we return `foo`.
  // Just simply compare their length, longer is better =)
  commandsMap.forEach((v, k) => {
    if (k === Root) {
      current = commandsMap.get(Root);
      currentName = Root;
      return;
    }
    if (arrayStartsWith(nameArr, k) && (!currentName || currentName === Root || k.length > currentName.length)) {
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
    ? process.argv.slice(process.versions.electron && !(process as any).defaultApp ? 1 : 2)
    : isDeno()
      // @ts-expect-error Ignore
      ? Deno.args
      : [];

export function compose(inspectors: Inspector[]) {
  const inspectorMap = {
    pre: [] as InspectorFn[],
    normal: [] as InspectorFn[],
    post: [] as InspectorFn[],
  };
  for (const inspector of inspectors) {
    const objectInspector: InspectorObject = typeof inspector === "object"
      ? inspector
      : { fn: inspector };
    const { enforce, fn } = objectInspector;
    if (enforce === "post" || enforce === "pre") {
      inspectorMap[enforce].push(fn);
    } else {
      inspectorMap.normal.push(fn);
    }
  }

  const mergedInspectorFns = [
    ...inspectorMap.pre,
    ...inspectorMap.normal,
    ...inspectorMap.post,
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

export const withBrackets = (s: string, isOptional?: boolean) => isOptional ? `[${s}]` : `<${s}>`;

const ROOT = "<Root>";
export const formatCommandName = (name: string | string[] | RootType) => Array.isArray(name)
  ? name.join(" ")
  : typeof name === "string"
    ? name
    : ROOT;
