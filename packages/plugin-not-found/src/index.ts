/* eslint-disable no-console */
// TODO: unit tests
import { NoSuchCommandError, definePlugin } from "@clerc/core";
import { semanticArray } from "@clerc/utils";
import { closest } from "fastest-levenshtein";
import pc from "picocolors";

export const notFoundPlugin = () => definePlugin({
  setup: (cli) => {
    return cli.inspector({
      enforce: "post",
      fn: (ctx, next) => {
        const commandKeys = Object.keys(cli._commands);
        const hasCommands = !!commandKeys.length;
        try {
          next();
        } catch (e) {
          if (!(e instanceof NoSuchCommandError)) { throw e; }
          if (ctx.raw._.length === 0) {
            console.log("No command given.");
            if (hasCommands) {
              console.log(`Possible commands: ${pc.bold(semanticArray(commandKeys))}.`);
            }
            return;
          }
          // Bad example :(
          const calledCommandName = e.message.replace("No such command: ", "");
          const closestCommandName = closest(calledCommandName, commandKeys);
          console.log(`Command "${pc.strikethrough(calledCommandName)}" not found.`);
          if (hasCommands) {
            console.log(`Did you mean "${pc.bold(closestCommandName)}"?`);
          } else {
            console.log("NOTE: You haven't register any command yet.");
          }
        }
      },
    });
  },
});
