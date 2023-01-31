
// TODO: unit tests

import { definePlugin } from "@clerc/core";
import { gracefulVersion } from "@clerc/utils";

import { locales } from "./locales";

interface VersionPluginOptions {
  command?: boolean
}
export const versionPlugin = ({ command = true }: VersionPluginOptions = {}) => definePlugin({
  setup: (cli) => {
    const { add, t } = cli.i18n;
    add(locales);
    const gracefullyVersion = gracefulVersion(cli._version);
    if (command) {
      cli = cli.command("version", t("version.description")!, {
        notes: [t("version.notes.1")!],
      })
        .on("version", () => {
          process.stdout.write(gracefullyVersion);
        });
    }
    cli = cli.flag("version", t("version.description")!, {
      alias: "V",
      type: Boolean,
      default: false,
    });
    return cli.inspector({
      enforce: "pre",
      fn: (ctx, next) => {
        if (!ctx.flags.version) { next(); } else { process.stdout.write(gracefullyVersion); }
      },
    });
  },
});
