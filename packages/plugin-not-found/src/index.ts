// TODO: unit tests
import { NoCommandGivenError, NoSuchCommandError, definePlugin } from "@clerc/core";
import { semanticArray } from "@clerc/utils";
import didyoumean from "didyoumean2";
import pc from "picocolors";

import { locales } from "./locales";

export const notFoundPlugin = () => definePlugin({
  setup: (cli) => {
    const { t, add } = cli.i18n;
    add(locales);
    return cli.inspector({
      enforce: "pre",
      fn: (ctx, next) => {
        const commandKeys = Object.keys(cli._commands);
        const hasCommands = !!commandKeys.length;
        try {
          next();
        } catch (e: any) {
          if (!(e instanceof NoSuchCommandError || e instanceof NoCommandGivenError)) { throw e; }
          if (ctx.raw._.length === 0 || e instanceof NoCommandGivenError) {
            console.error(t("core.noCommandGiven"));
            if (hasCommands) {
              console.error(t("notFound.possibleCommands", semanticArray(commandKeys, cli.i18n)));
            }
            return;
          }
          // Good example =]
          const calledCommandName = e.commandName;
          const closestCommandName = didyoumean(calledCommandName, commandKeys);
          console.error(t("notFound.commandNotFound", pc.strikethrough(calledCommandName)));
          if (hasCommands && closestCommandName) {
            console.error(t("notFound.didyoumean", pc.bold(closestCommandName)));
          } else if (!hasCommands) {
            console.error(t("notFound.commandNotRegisteredNote"));
          }
          process.stderr.write("\n");
          process.exit(2);
        }
      },
    });
  },
});
