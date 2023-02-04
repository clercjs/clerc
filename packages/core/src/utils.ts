import { IS_DENO, IS_ELECTRON, IS_NODE } from "is-platform";
import { arrayEquals, arrayStartsWith, toArray } from "@clerc/utils";

import type { RootType } from "./cli";
import { Root } from "./cli";
import type { Command, CommandAlias, CommandRecord, CommandType, Inspector, InspectorContext, InspectorFn, InspectorObject, TranslateFn } from "./types";
import { CommandNameConflictError } from "./errors";

function setCommand(commandsMap: Map<string[] | RootType, CommandAlias>, commands: CommandRecord, command: Command, t: TranslateFn) {
  if (command.alias) {
    const aliases = toArray(command.alias);
    for (const alias of aliases) {
      if (alias in commands) {
        throw new CommandNameConflictError(commands[alias]!.name, command.name, t);
      }
      commandsMap.set(typeof alias === "symbol" ? alias : alias.split(" "), { ...command, __isAlias: true });
    }
  }
}

export function resolveFlattenCommands(commands: CommandRecord, t: TranslateFn) {
  const commandsMap = new Map<string[] | RootType, CommandAlias>();
  if (commands[Root]) {
    commandsMap.set(Root, commands[Root]);
    setCommand(commandsMap, commands, commands[Root], t);
  }
  for (const command of Object.values(commands)) {
    setCommand(commandsMap, commands, command, t);
    commandsMap.set(command.name.split(" "), command);
  }
  return commandsMap;
}

export function resolveCommand(commands: CommandRecord, name: CommandType | string[], t: TranslateFn): [Command<string | RootType> | undefined, string[] | RootType | undefined] {
  if (name === Root) { return [commands[Root], Root]; }
  const nameArr = toArray(name) as string[];
  const commandsMap = resolveFlattenCommands(commands, t);
  let current: Command | undefined;
  let currentName: string[] | RootType | undefined;
  commandsMap.forEach((v, k) => {
    if (k === Root) {
      current = commands[Root];
      currentName = Root;
      return;
    }
    if (arrayStartsWith(nameArr, k) && (!currentName || currentName === Root || k.length > currentName.length)) {
      current = v;
      currentName = k;
    }
  });
  return [current, currentName];
}

export function resolveCommandStrict(commands: CommandRecord, name: CommandType | string[], t: TranslateFn): [Command<string | RootType> | undefined, string[] | RootType | undefined] {
  if (name === Root) { return [commands[Root], Root]; }
  const nameArr = toArray(name) as string[];
  const commandsMap = resolveFlattenCommands(commands, t);
  let current: Command | undefined;
  let currentName: string[] | RootType | undefined;
  commandsMap.forEach((v, k) => {
    if (k === Root || currentName === Root) {
      return;
    }
    if (arrayEquals(nameArr, k)) {
      current = v;
      currentName = k;
    }
  });
  return [current, currentName];
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
  IS_NODE
    ? process.argv.slice(IS_ELECTRON ? 1 : 2)
    : IS_DENO
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
  return async (getCtx: () => InspectorContext) => {
    return await dispatch(0);
    async function dispatch(i: number): Promise<void> {
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

export const detectLocale = () => process.env.CLERC_LOCALE
  ? process.env.CLERC_LOCALE
  : Intl.DateTimeFormat().resolvedOptions().locale;
