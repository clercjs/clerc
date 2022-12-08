/* eslint-disable no-console */
// TODO: unit tests
import { NoSuchCommandError, definePlugin } from "@clerc/core";
import { closest } from "fastest-levenshtein";
import pc from "picocolors";

export const notFoundPlugin = () => definePlugin({
  setup (cli) {
    return cli.inspector((ctx, next) => {
      try {
        next();
      } catch (e) {
        if (!(e instanceof NoSuchCommandError)) { throw e; }
        if (ctx.raw._.length === 0) {
          console.log("No command given.");
          console.log(`Possible commands: ${pc.bold(Object.keys(cli._commands).join(", "))}.`);
          return;
        }
        // Bad example :(
        const calledCommandName = e.message.replace("No such command: ", "");
        const closestCommandName = closest(calledCommandName, Object.keys(cli._commands));
        console.log(`Command "${pc.strikethrough(calledCommandName)}" not found.`);
        console.log(`Did you mean "${pc.bold(closestCommandName)}"?`);
      }
    });
  },
});
