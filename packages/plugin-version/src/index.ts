import type { Plugin } from "@clerc/core";
import { definePlugin } from "@clerc/core";
import { gracefulVersion } from "@clerc/utils";

import { locales } from "./locales";

interface VersionPluginOptions {
	/**
	 * Whether to register the version command.
	 *
	 * @default true
	 */
	command?: boolean;
	/**
	 * Whether to register the global version flag.
	 *
	 * @default true
	 */
	flag?: boolean;
}
export const versionPlugin = ({
	command = true,
	flag = true,
}: VersionPluginOptions = {}): Plugin =>
	definePlugin({
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
				cli.interceptor({
					enforce: "pre",
					fn: (ctx, next) => {
						if (ctx.flags.version) {
							process.stdout.write(gracefullyVersion);
						} else {
							next();
						}
					},
				});
			}

			return cli;
		},
	});
