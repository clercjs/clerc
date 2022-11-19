/* eslint-disable no-console */
// TODO: unit tests
import { NoSuchCommandError, definePlugin } from "clerc";
import { closest } from "fastest-levenshtein";

export const notFoundPlugin = () => definePlugin({
  setup (cli) {
    return cli.inspector((ctx, next) => {
      try {
        next();
      } catch (e) {
        if (!(e instanceof NoSuchCommandError)) { throw e; }
        if (ctx.parameters.length === 0) {
          console.log("No command given.");
          console.log(`Possible commands: ${Object.keys(cli._commands).join(", ")}.`);
          return;
        }
        const calledCommandName = String(ctx.parameters[0]);
        const closestCommandName = closest(calledCommandName, Object.keys(cli._commands));
        console.log(`Command "${calledCommandName}" not found.`);
        console.log(`Did you mean "${closestCommandName}"?`);
      }
    });
  },
});
