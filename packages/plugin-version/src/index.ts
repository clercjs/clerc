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
			if (command) {
				cli
					.command("version", "Prints current version", {})
					.on("version", () => {
						console.log(formatVersion(cli._version));
					});
			}
			if (flag) {
				cli
					.globalFlag("version", "Prints current version", {
						short: "V",
						type: Boolean,
						default: false,
					})
					.interceptor({
						enforce: "pre",
						handler: async (ctx, next) => {
							if (ctx.flags.version) {
								console.log(formatVersion(cli._version));
							} else {
								await next();
							}
						},
					});
			}
		},
	});
