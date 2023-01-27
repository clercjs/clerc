// TODO: unit tests

import { definePlugin } from "@clerc/core";
import * as kons from "kons";

export const friendlyErrorPlugin = () => definePlugin({
  setup: (cli) => {
    return cli.inspector({
      enforce: "pre",
      fn: (_ctx, next) => {
        try {
          next();
        } catch (e: any) {
          kons.error(e.message);
          process.exit(1);
        }
      },
    });
  },
});
