import {
	NoCommandGivenError,
	NoSuchCommandError,
	definePlugin,
} from "@clerc/core";
import didyoumean from "didyoumean2";
import * as yc from "yoctocolors";

export const notFoundPlugin = () =>
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
								e instanceof NoCommandGivenError
							)
						) {
							throw e;
						}
						if (e instanceof NoCommandGivenError) {
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
