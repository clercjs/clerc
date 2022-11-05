import { isDeno, isNode } from "is-platform";
import type { Command, CommandRecord, Dict, HandlerContext, Invoker, MaybeArray } from "./types";

export function resolveFlagAlias (command: Command) {
  return Object.entries(command?.flags || {}).reduce((acc, [name, { alias }]) => {
    if (alias) {
      acc[name] = alias;
    }
    return acc;
  }, {} as Dict<MaybeArray<string>>);
}

export function resolveCommand (commands: CommandRecord, name: string): Command | undefined {
  const possibleCommands = Object.values(commands).filter(c => c.name === name || c.alias?.includes(name));
  if (possibleCommands.length > 1) {
    throw new Error(`Multiple commands found with name "${name}"`);
  }
  return possibleCommands[0];
}

export const resolveArgv = () =>
  isNode()
    ? process.argv.slice(2)
    : isDeno()
      // @ts-expect-error Ignore
      ? Deno.args
      : [];

export function compose (invokers: Invoker[]) {
  return (ctx: HandlerContext) => {
    return dispatch(0);
    function dispatch (i: number): void {
      const invoker = invokers[i];
      return invoker(ctx, dispatch.bind(null, i + 1));
    }
  };
}
