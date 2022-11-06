import { isDeno, isNode } from "is-platform";
import type { Command, CommandRecord, Dict, FlagOptions, HandlerContext, Inspector } from "./types";

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
export const resolveDefault = createFlagHoist("default");

export function resolveCommand (commands: CommandRecord, name: string): Command | undefined {
  const possibleCommands = Object.values(commands).filter(c => c.name === name || c.alias?.includes(name));
  if (possibleCommands.length > 1) {
    throw new Error(`Multiple commands found with name "${name}"`);
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
  return (ctx: HandlerContext) => {
    return dispatch(0);
    function dispatch (i: number): void {
      const inspector = inspectors[i];
      return inspector(ctx, dispatch.bind(null, i + 1));
    }
  };
}
