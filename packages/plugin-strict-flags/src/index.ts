// TODO: unit tests
// TODO: parameters
import { definePlugin } from "@clerc/core";
import { semanticArray } from "@clerc/utils";

export const strictFlagsPlugin = () => definePlugin({
  setup: (cli) => {
    return cli.inspector((ctx, next) => {
      const keys = Object.keys(ctx.unknownFlags);
      if (keys.length > 0) {
        throw new Error(`Unexpected flags: ${semanticArray(keys)}`);
      }
      next();
    });
  },
});
