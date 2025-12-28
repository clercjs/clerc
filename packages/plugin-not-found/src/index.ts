import type { Plugin } from "@clerc/core";
import {
  NoCommandSpecifiedError,
  NoSuchCommandError,
  definePlugin,
} from "@clerc/core";
import * as tint from "@uttr/tint";
import { closest, distance } from "fastest-levenshtein";

export interface NotFoundPluginOptions {
  /**
   * Distance threshold for suggesting commands.
   *
   * @default 5
   */
  distanceThreshold?: number;
}

export const notFoundPlugin = ({
  distanceThreshold = 5,
}: NotFoundPluginOptions = {}): Plugin =>
  definePlugin({
    setup: (cli) =>
      cli.interceptor({
        enforce: "post",
        handler: async (_ctx, next) => {
          const commandKeys = [...cli._commands.keys()];
          const hasCommands = commandKeys.length > 0;
          try {
            await next();
          } catch (e: any) {
            if (
              !(e instanceof NoSuchCommandError) &&
              !(e instanceof NoCommandSpecifiedError)
            ) {
              throw e;
            }
            if (e instanceof NoCommandSpecifiedError) {
              let text = "No command specified.";
              if (hasCommands) {
                text += `\nPossible commands: ${commandKeys.join(", ")}.`;
              }

              throw new NoCommandSpecifiedError(text);
            }

            const { commandName } = e;
            let closestCommandName: string | undefined = closest(
              commandName,
              commandKeys,
            );
            const dist = distance(commandName, closestCommandName);
            if (dist > distanceThreshold) {
              closestCommandName = undefined;
            }
            let text = `Command "${tint.strikethrough(commandName)}" not found.`;

            if (hasCommands && closestCommandName) {
              text += `\nDid you mean "${tint.bold(closestCommandName)}"?`;
            } else if (!hasCommands) {
              text += "\nNo commands registered.";
            }

            throw new NoSuchCommandError(commandName, text);
          }
        },
      }),
  });
