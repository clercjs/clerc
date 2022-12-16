// TODO: unit tests
// TODO: parameters
import { definePlugin } from "@clerc/core";
import { kons } from "@clerc/toolkit";

export const friendlyErrorPlugin = () => definePlugin({
  setup: (cli) => {
    return cli.inspector({
      enforce: "pre",
      fn: (_ctx, next) => {
        try {
          next();
        } catch (e: any) {
          kons.error(e.message);
        }
      },
    });
  },
});
