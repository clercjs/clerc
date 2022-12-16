/* eslint-disable no-console */
// TODO: unit tests
// TODO: parameters
import { definePlugin } from "@clerc/core";

interface Options {
  alias?: string[]
}
export const versionPlugin = ({
  alias = ["V"],
}: Options = {}) => definePlugin({
  setup: (cli) => {
    return cli.command("version", "Show version")
      .on("version", () => {
        console.log(cli._version);
      })
      .inspector((ctx, next) => {
        let hasVersionFlag = false;
        const versionFlags = ["version", ...alias];
        console.log(ctx.raw.mergedFlags);
        for (const k of Object.keys(ctx.raw.mergedFlags)) {
          if (versionFlags.includes(k)) {
            hasVersionFlag = true;
            break;
          }
        }
        if (!hasVersionFlag) { next(); }
        console.log(cli._version);
      });
  },
});
