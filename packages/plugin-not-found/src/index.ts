/* eslint-disable no-console */
// TODO: unit tests
import { NoCommandGivenError, NoSuchCommandError, definePlugin } from "@clerc/core";
import { semanticArray } from "@clerc/utils";
import didyoumean from "didyoumean2";
import * as colors from "colorette";

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
            console.log("No command given.");
            if (hasCommands) {
              console.log(`Possible commands: ${colors.bold(semanticArray(commandKeys))}.`);
            }
            return;
          }
          // Bad example :(
          const calledCommandName = e.message.replace("No such command: ", "");
          const closestCommandName = didyoumean(calledCommandName, commandKeys);
          console.log(`Command "${colors.strikethrough(calledCommandName)}" not found.`);
          if (hasCommands && closestCommandName) {
            console.log(`Did you mean "${colors.bold(closestCommandName)}"?`);
          } else if (!hasCommands) {
            console.log("NOTE: You haven't register any command yet.");
          }
        }
      },
    });
  },
});
