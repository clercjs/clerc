import type { Command, CommandRecord, MaybeArray } from "clerc";

const mustArray = <T>(a: MaybeArray<T>) => Array.isArray(a) ? a : [a];
const gracefulFlagName = (n: string) => n.length <= 1 ? `-${n}` : `--${n}`;

export function generateNameAndAliasFromCommands (commands: CommandRecord) {
  return Object.fromEntries(
    Object.entries(commands)
      .map(([name, command]) => [name, [name, ...(command.alias ? mustArray(command.alias) : [])].join(", ")]),
  );
}
export function generateFlagNameAndAliasFromCommand (command: Command) {
  return Object.fromEntries(
    Object.entries(command.flags || {})
      .map(([name, flag]) => [name, [name, ...mustArray(flag.alias || "")].map(gracefulFlagName).join(", ")]),
  );
}

export function getPadLength (strings: string[]) {
  const maxLength = Math.max(...strings.map(n => n.length));
  return Math.floor((maxLength + 4) / 4) * 4;
}
