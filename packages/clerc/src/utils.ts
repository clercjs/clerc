import { isDeno, isNode } from "is-platform";
import type { Dict } from "@clerc/utils";
import { kebabCase, mustArray } from "@clerc/utils";
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
  return (getCtx: () => InspectorContext) => {
    return dispatch(0);
    function dispatch (i: number): void {
      const inspector = inspectors[i];
      return inspector(getCtx(), dispatch.bind(null, i + 1));
    }
  };
}
