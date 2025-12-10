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
							let text = "No command specified.";
							if (hasCommands) {
								text += `\nPossible commands: ${commandKeys.join(", ")}.`;
							}

							throw new NoCommandSpecifiedError(text);
						}

						const { commandName } = e;
						const closestCommandName = didyoumean(commandName, commandKeys);
						let text = `Command "${yc.strikethrough(commandName)}" not found.`;

						if (hasCommands && closestCommandName) {
							text += `\nDid you mean "${yc.bold(closestCommandName)}"?`;
						} else if (!hasCommands) {
							text += "\nNo commands registered.";
						}

						throw new NoSuchCommandError(commandName, text);
					}
				},
			}),
	});
