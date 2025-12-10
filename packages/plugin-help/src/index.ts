import { definePlugin, resolveCommand } from "@clerc/core";

import { HelpRenderer } from "./renderer";
import { print } from "./utils";

declare module "@clerc/core" {
	export interface CommandCustomOptions {
		help?: {
			notes?: string[];
			examples?: [string, string][];
		};
	}
}

export interface HelpPluginOptions {
	command?: boolean;
	flag?: boolean;
	showHelpWhenNoCommandSpecified?: boolean;
	notes?: string[];
	examples?: [string, string][];
	banner?: string;
}

export const helpPlugin = ({
	command = true,
	flag = true,
	showHelpWhenNoCommandSpecified = true,
	notes,
	examples,
	banner,
}: HelpPluginOptions = {}) =>
	definePlugin({
		setup: (cli) => {
			function printHelp(s: string) {
				if (banner) {
					print(`${banner}\n`);
				}
				print(s);
			}

			if (command) {
				cli
					.command("help", "Show help", {
						parameters: ["[command...]"],
					})
					.on("help", (ctx) => {
						const commandName = ctx.parameters.command;
						let command;
						if (commandName.length > 0) {
							[command] = resolveCommand(cli._commands, commandName);

							if (!command) {
								console.error(`Command "${commandName.join(" ")}" not found.`);

								return;
							}
						}

						const renderer = new HelpRenderer(
							cli,
							command,
							cli._globalFlags,
							command ? command.help?.notes : notes,
							command ? command.help?.examples : examples,
						);
						printHelp(renderer.render());
					});
			}

			if (flag) {
				cli.globalFlag("help", "Show help", {
					alias: "h",
					type: Boolean,
					default: false,
				});
			}

			cli.interceptor({
				enforce: "pre",
				handler: async (ctx, next) => {
					if (ctx.flags.help) {
						const renderer = new HelpRenderer(
							cli,
							ctx.command,
							cli._globalFlags,
							ctx.command ? ctx.command.help?.notes : notes,
							ctx.command ? ctx.command.help?.examples : examples,
						);
						printHelp(renderer.render());
					} else {
						const shouldShowHelp =
							showHelpWhenNoCommandSpecified &&
							!ctx.command && // no command resolved
							ctx.rawParsed.parameters.length === 0; // and no command supplied, means no root command defined

						if (shouldShowHelp) {
							const renderer = new HelpRenderer(
								cli,
								undefined,
								cli._globalFlags,
								notes,
								examples,
							);
							printHelp(renderer.render());
						} else {
							await next();
						}
					}
				},
			});
		},
	});
