// TODO: unit tests
import { NoCommandGivenError, NoSuchCommandError, definePlugin } from "@clerc/core";
import { semanticArray } from "@clerc/utils";
import didyoumean from "didyoumean2";
import pc from "picocolors";

export const notFoundPlugin = () => definePlugin({
  setup: (cli) => {
    return cli.inspector({
      enforce: "pre",
      fn: (ctx, next) => {
        const commandKeys = Object.keys(cli._commands);
        const hasCommands = !!commandKeys.length;
        try {
          next();
        } catch (e: any) {
          if (!(e instanceof NoSuchCommandError || e instanceof NoCommandGivenError)) { throw e; }
          if (ctx.raw._.length === 0) {
            console.error("No command given.");
            if (hasCommands) {
              console.error(`Possible commands: ${pc.bold(semanticArray(commandKeys))}.`);
            }
            return;
          }
          // Good example =]
          const calledCommandName = e.name;
          const closestCommandName = didyoumean(calledCommandName, commandKeys);
          console.error(`Command "${pc.strikethrough(calledCommandName)}" not found.`);
          if (hasCommands && closestCommandName) {
            console.error(`Did you mean "${pc.bold(closestCommandName)}"?`);
          } else if (!hasCommands) {
            console.error("NOTE: You haven't register any command yet.");
          }
        }
      },
    });
  },
});
