/* eslint-disable no-console */
// TODO: unit tests
// TODO: parameters
import { definePlugin } from "@clerc/core";
import { gracefulVersion } from "@clerc/utils";

interface Options {
  alias?: string[]
  command?: boolean
}
export const versionPlugin = ({
  alias = ["V"],
  command = true,
}: Options = {}) => definePlugin({
  setup: (cli) => {
    const gracefullyVersion = gracefulVersion(cli._version);
    return cli
      .inspector({
        enforce: "post",
        fn: (ctx, next) => {
          if (!ctx.isSingleCommand && command) {
            cli = cli.command("version", "Show version")
              .on("version", () => {
                console.log(gracefullyVersion);
              });
          }
          next();
        },
      })
      .inspector({
        enforce: "pre",
        fn: (ctx, next) => {
          let hasVersionFlag = false;
          const versionFlags = ["version", ...alias];
          for (const k of Object.keys(ctx.raw.mergedFlags)) {
            if (versionFlags.includes(k)) {
              hasVersionFlag = true;
              break;
            }
          }
          if (!hasVersionFlag) { next(); } else { console.log(gracefullyVersion); }
        },
      });
  },
});
