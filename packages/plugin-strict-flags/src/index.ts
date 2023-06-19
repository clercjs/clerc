// TODO: unit tests

import { definePlugin } from "@clerc/core";
import { semanticArray } from "@clerc/utils";

import { locales } from "./locales";

export const strictFlagsPlugin = () =>
  definePlugin({
    setup: (cli) => {
      const { add, t } = cli.i18n;
      add(locales);

      return cli.inspector((ctx, next) => {
        const keys = Object.keys(ctx.unknownFlags);
        if (!ctx.resolved || keys.length === 0) {
          next();
        } else {
          const error =
            keys.length > 1
              ? new Error(
                  t(
                    "strictFlags.unexpectedMore",
                    semanticArray(keys, cli.i18n),
                  ),
                )
              : new Error(
                  t(
                    "strictFlags.unexpectedSingle",
                    semanticArray(keys, cli.i18n),
                  ),
                );
          throw error;
        }
      });
    },
  });
