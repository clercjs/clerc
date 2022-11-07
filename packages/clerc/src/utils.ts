import { isDeno, isNode } from "is-platform";
import type { SingleCommandType } from "./cli";
import type { Command, CommandRecord, Dict, FlagOptions, Inspector, InspectorContext, MaybeArray } from "./types";

function createFlagHoist<K extends keyof FlagOptions> (k: K) {
  return (_command: Command) =>
    Object.entries(_command?.flags || {}).reduce((acc, [name, command]) => {
      const item = command[k];
      if (item) {
        acc[name] = item;
      }
      return acc;
    }, {} as Dict<NonNullable<FlagOptions[K]>>);
}
export const resolveFlagAlias = createFlagHoist("alias");
export const resolveFlagDefault = createFlagHoist("default");

const mustArray = <T>(a: MaybeArray<T>) => Array.isArray(a) ? a : [a];

export function resolveCommand (commands: CommandRecord, name: string | SingleCommandType): Command | undefined {
  const possibleCommands = Object.values(commands).filter(c => c.name === name || mustArray(c.alias || []).map(String).includes(name));
  if (possibleCommands.length > 1) {
    throw new Error(`Multiple commands found with name "${name as string}"`);
  }
  return possibleCommands[0];
}

export const resolveArgv = (): string[] =>
  isNode()
    ? process.argv.slice(2)
    : isDeno()
      // @ts-expect-error Ignore
      ? Deno.args
      : [];

export function compose (inspectors: Inspector[]) {
  return (ctx: InspectorContext) => {
    return dispatch(0);
    function dispatch (i: number): void {
      const inspector = inspectors[i];
      return inspector(ctx, dispatch.bind(null, i + 1));
    }
  };
}
