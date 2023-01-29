
// TODO: unit tests

import { definePlugin } from "@clerc/core";
import { gracefulVersion } from "@clerc/utils";

import { locales } from "./locales";

interface VersionPluginOptions {
  alias?: string[]
  command?: boolean
}
export const versionPlugin = ({
  alias = ["V"],
  command = true,
}: VersionPluginOptions = {}) => definePlugin({
  setup: (cli) => {
    const { add, t } = cli.i18n;
    add(locales);
    const gracefullyVersion = gracefulVersion(cli._version);
    if (command) {
      cli = cli.command("version", t("version.commandDescription")!, {
        notes: [t("version.notes.1")!],
      })
        .on("version", () => {
          process.stdout.write(gracefullyVersion);
        });
    }
    return cli.inspector({
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
        if (!hasVersionFlag) { next(); } else { process.stdout.write(gracefullyVersion); }
      },
    });
  },
});
