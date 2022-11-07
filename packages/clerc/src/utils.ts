import { isDeno, isNode } from "is-platform";
import type { SingleCommandType } from "./cli";
import { SingleCommand } from "./cli";
import type { Command, CommandRecord, Dict, FlagOptions, Inspector, InspectorContext, MaybeArray } from "./types";

const mustArray = <T>(a: MaybeArray<T>) => Array.isArray(a) ? a : [a];

export type CamelCase<T extends string> = T extends `${infer A}-${infer B}${infer C}`
  ? `${A}${Capitalize<B>}${CamelCase<C>}`
  : T;
export const camelCase = <T extends string>(s: T): CamelCase<T> => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) as CamelCase<T>;

export type KebabCase<T extends string, A extends string = ""> = T extends `${infer F}${infer R}`
  ? KebabCase<R, `${A}${F extends Lowercase<F> ? "" : "-"}${Lowercase<F>}`>
  : A;
export const kebabCase = <T extends string>(s: T): KebabCase<T> => s.replace(/([A-Z])/g, (_, c) => `-${c.toLowerCase()}`) as KebabCase<T>;

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

export function resolveCommand (commands: CommandRecord, name: string | SingleCommandType): Command | undefined {
  if (name === SingleCommand) {
    return commands[SingleCommand];
  }
  const possibleCommands = Object.values(commands)
    .filter(c => c.name === name || mustArray(c.alias || [])
      .map(String)
      .includes(name),
    );
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
