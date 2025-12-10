import type { Plugin } from "@clerc/core";
import { definePlugin } from "@clerc/core";
import { formatVersion } from "@clerc/utils";

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
			const formattedVersion = formatVersion(cli._version);
			if (command) {
				cli
					.command("version", "Prints current version", {
						// TODO
						// help: {
						// 	notes: [t("version.notes.1")!],
						// },
					})
					.on("version", () => {
						// eslint-disable-next-line no-console
						console.log(formattedVersion);
					});
			}
			if (flag) {
				cli
					.globalFlag("version", "Prints current version", {
						alias: "V",
						type: Boolean,
						default: false,
					})
					.interceptor({
						enforce: "pre",
						handler: async (ctx, next) => {
							if (ctx.flags.version) {
								// eslint-disable-next-line no-console
								console.log(formattedVersion);
							} else {
								await next();
							}
						},
					});
			}
		},
	});
