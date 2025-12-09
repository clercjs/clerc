import type { Plugin } from "@clerc/core";
import { definePlugin } from "@clerc/core";

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

const formatVersion = (v: string) =>
	v.length === 0 ? "" : v.startsWith("v") ? v : `v${v}`;

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
						process.stdout.write(formattedVersion);
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
								process.stdout.write(formattedVersion);
							} else {
								await next();
							}
						},
					});
			}
		},
	});
