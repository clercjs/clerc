import type { Plugin } from "@clerc/core";
import {
	NoCommandSpecifiedError,
	NoSuchCommandError,
	definePlugin,
} from "@clerc/core";
import didyoumean from "didyoumean2";
import * as yc from "yoctocolors";

export const notFoundPlugin = (): Plugin =>
	definePlugin({
		setup: (cli) =>
			cli.interceptor({
				enforce: "post",
				handler: async (_ctx, next) => {
					const commandKeys = [...cli._commands.keys()];
					const hasCommands = commandKeys.length > 0;
					try {
						await next();
					} catch (e: any) {
						if (
							!(
								e instanceof NoSuchCommandError ||
								e instanceof NoCommandSpecifiedError
							)
						) {
							throw e;
						}
						if (e instanceof NoCommandSpecifiedError) {
							console.error("No command specified.");
							if (hasCommands) {
								console.error(`Possible commands: ${commandKeys.join(", ")}`);
							}

							return;
						}

						const { commandName } = e;
						const closestCommandName = didyoumean(commandName, commandKeys);
						console.error(
							`Command "${yc.strikethrough(commandName)}" not found.`,
						);
						if (hasCommands && closestCommandName) {
							console.error(`Did you mean "${yc.bold(closestCommandName)}"?`);
						} else if (!hasCommands) {
							console.error("No commands registered.");
						}
						process.exit(2);
					}
				},
			}),
	});
