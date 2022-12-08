import type { Command, CommandRecord, HandlerContext, InspectorContext } from "@clerc/core";
import { gracefulFlagName, mustArray } from "@clerc/utils";

export function generateNameAndAliasFromCommands (commands: CommandRecord) {
  return Object.fromEntries(
    Object.entries(commands)
      .map(([name, command]) => [name, [name, ...(command.alias ? mustArray(command.alias) : [])].join(", ")]),
  );
}
export function generateFlagNameAndAliasFromCommand (command: Command) {
  return Object.fromEntries(
    Object.entries(command.flags || {})
      .map(([name, flag]) => {
        const nameAndAlias = [name];
        if (flag.alias) {
          nameAndAlias.push(...mustArray(flag.alias));
        }
        return [name, nameAndAlias.map(gracefulFlagName).join(", ")];
      },
      ),
  );
}

export function getPadLength (strings: string[]) {
  const maxLength = Math.max(...strings.map(n => n.length));
  return Math.floor((maxLength + 4) / 4) * 4;
}

export const mergeFlags = (ctx: HandlerContext | InspectorContext) => ({ ...ctx.flags, ...ctx.unknownFlags });
