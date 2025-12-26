import type { Plugin } from "@clerc/core";
import { NoSuchCommandError, definePlugin, resolveCommand } from "@clerc/core";
import { isTruthy } from "@clerc/utils";

import { defaultFormatters } from "./formatters";
import { HelpRenderer } from "./renderer";
import { addStoreApi } from "./store";
import type { Formatters, GroupsOptions } from "./types";

export { defaultFormatters } from "./formatters";
export type { GroupDefinition, GroupsOptions } from "./types";

export interface HelpOptions {
	/**
	 * The group this item belongs to. The group must be defined in the `groups`
	 * option of `helpPlugin()`.
	 */
	group?: string;
}

export interface CommandHelpOptions extends HelpOptions {
	/**
	 * Whether to show the command in help output.
	 *
	 * @default true
	 */
	show?: boolean;
	/**
	 * Notes to show in the help output.
	 */
	notes?: string[];
	/**
	 * Examples to show in the help output. Each example is a tuple of `[command,
	 * description]`.
	 */
	examples?: [string, string][];
}

declare module "@clerc/core" {
	export interface CommandCustomOptions {
		/**
		 * Help options for the command.
		 */
		help?: CommandHelpOptions;
	}

	export interface FlagCustomOptions {
		/**
		 * Help options for the flag.
		 */
		help?: HelpOptions;
	}
}

export interface HelpPluginOptions {
	/**
	 * Whether to register the `help` command.
	 *
	 * @default true
	 */
	command?: boolean;
	/**
	 * Whether to register the `--help` global flag.
	 *
	 * @default true
	 */
	flag?: boolean;
	/**
	 * Whether to show help when no command is specified.
	 *
	 * @default true
	 */
	showHelpWhenNoCommandSpecified?: boolean;
	/**
	 * Notes to show in the help output.
	 */
	notes?: string[];
	/**
	 * Examples to show in the help output. Each example is a tuple of `[command,
	 * description]`.
	 */
	examples?: [string, string][];
	/**
	 * Header to show before the help output.
	 */
	header?: string;
	/**
	 * Footer to show after the help output.
	 */
	footer?: string;
	/**
	 * Custom formatters for rendering help.
	 */
	formatters?: Partial<Formatters>;
	/**
	 * Group definitions for commands and flags. Groups allow organizing commands
	 * and flags into logical sections in help output. Each group is defined as
	 * `[key, name]` where `key` is the identifier used in help options and `name`
	 * is the display name shown in help output.
	 */
	groups?: GroupsOptions;
}

export const helpPlugin = ({
	command = true,
	flag = true,
	showHelpWhenNoCommandSpecified = true,
	notes,
	examples,
	header,
	footer,
	formatters,
	groups = {},
}: HelpPluginOptions = {}): Plugin =>
	definePlugin({
		setup: (cli) => {
			addStoreApi(cli, { groups });

			const mergedFormatters = {
				...defaultFormatters,
				...formatters,
			};

			function printHelp(s: string) {
				if (header) {
					console.log(header);
				}
				console.log(s);
				if (footer) {
					console.log(footer);
				}
			}

			const renderer = new HelpRenderer(
				mergedFormatters,
				cli,
				cli._globalFlags,
				() => groups,
				examples,
				notes,
			);

			function tryPrintSubcommandsHelp(commandName: string) {
				const subcommandsOutput =
					renderer.renderAvailableSubcommands(commandName);

				if (subcommandsOutput) {
					printHelp(subcommandsOutput);

					return true;
				}

				return false;
			}

			if (command) {
				cli
					.command("help", "Show help", {
						parameters: ["[command...]"],
						help: {
							notes: [
								"If no command is specified, show help for the CLI.",
								"If a command is specified, show help for the command.",
								flag && "-h is an alias for --help.",
							].filter(isTruthy),
							examples: [
								command && [`$ ${cli._scriptName} help`, "Show help"],
								command && [
									`$ ${cli._scriptName} help <command>`,
									"Show help for a specific command",
								],
								flag && [
									`$ ${cli._scriptName} <command> --help`,
									"Show help for a specific command",
								],
							].filter(isTruthy) as [string, string][],
						},
					})
					.on("help", (ctx) => {
						const commandName = ctx.parameters.command;
						let command;
						if (commandName.length > 0) {
							[command] = resolveCommand(cli._commands, commandName);

							if (!command) {
								const parentCommandName = commandName.join(" ");

								if (tryPrintSubcommandsHelp(parentCommandName)) {
									return;
								}

								// No subcommands, throw error
								throw new NoSuchCommandError(parentCommandName);
							}
						}

						renderer.setCommand(command);
						printHelp(renderer.render());
					});
			}

			if (flag) {
				cli.globalFlag("help", "Show help", {
					short: "h",
					type: Boolean,
					default: false,
				});
			}

			cli.interceptor({
				enforce: "post",
				handler: async (ctx, next) => {
					if (ctx.flags.help) {
						const command = ctx.command;
						// If no command resolved, but parameters are present, just let the next interceptor handle it
						if (!command && ctx.rawParsed.parameters.length > 0) {
							const parentCommandName = ctx.rawParsed.parameters.join(" ");

							if (tryPrintSubcommandsHelp(parentCommandName)) {
								return;
							}

							await next();
						}

						renderer.setCommand(command);
						printHelp(renderer.render());
					} else {
						const shouldShowHelp =
							showHelpWhenNoCommandSpecified &&
							!ctx.command && // no command resolved
							ctx.rawParsed.parameters.length === 0; // and no command supplied, means no root command defined

						if (shouldShowHelp) {
							const text = "No command specified. Showing help:\n";
							console.log(text);
							printHelp(renderer.render());
						} else {
							await next();
						}
					}
				},
			});
		},
	});
