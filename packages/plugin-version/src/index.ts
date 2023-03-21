import { definePlugin } from "@clerc/core";
import { gracefulVersion } from "@clerc/utils";

import { locales } from "./locales";

interface VersionPluginOptions {
  /**
   * Whether to register the help command.
   * @default true
   */
  command?: boolean
  /**
     * Whether to register the global help flag.
     * @default true
     */
  flag?: boolean
}
export const versionPlugin = ({
  command = true,
  flag = true,
}: VersionPluginOptions = {}) => definePlugin({
  setup: (cli) => {
    const { add, t } = cli.i18n;
    add(locales);
    const gracefullyVersion = gracefulVersion(cli._version);
    if (command) {
      cli = cli
        .command("version", t("version.description")!, {
          help: {
            notes: [t("version.notes.1")!],
          },
        })
        .on("version", () => {
          process.stdout.write(gracefullyVersion);
        });
    }
    if (flag) {
      cli = cli.flag("version", t("version.description")!, {
        alias: "V",
        type: Boolean,
        default: false,
      });
      cli.inspector({
        enforce: "pre",
        fn: (ctx, next) => {
          if (!ctx.flags.version) { next(); } else { process.stdout.write(gracefullyVersion); }
        },
      });
    }
    return cli;
  },
});
