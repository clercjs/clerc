import type { Plugin } from "@clerc/core";
import { definePlugin, resolveCommand } from "@clerc/core";
import { isTruthy } from "@clerc/utils";

import { defaultFormatters } from "./formatters";
import { HelpRenderer } from "./renderer";
import type { Formatters } from "./types";

declare module "@clerc/core" {
	export interface CommandCustomOptions {
		help?: {
			showInHelp?: boolean;
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
	formatters?: Partial<Formatters>;
}

export const helpPlugin = ({
	command = true,
	flag = true,
	showHelpWhenNoCommandSpecified = true,
	notes,
	examples,
	banner,
	formatters,
}: HelpPluginOptions = {}): Plugin =>
	definePlugin({
		setup: (cli) => {
			const mergedFormatters = {
				...defaultFormatters,
				...formatters,
			};

			const generalHelpNotes = [
				"If no command is specified, show help for the CLI.",
				"If a command is specified, show help for the command.",
				flag && "-h is an alias for --help.",
			].filter(isTruthy);
			const generalHelpExamples = [
				command && [`$ ${cli._scriptName} help`, "Show help"],
				command && [
					`$ ${cli._scriptName} help <command>`,
					"Show help for a specific command",
				],
				flag && [
					`$ ${cli._scriptName} <command> --help`,
					"Show help for a specific command",
				],
			].filter(isTruthy) as [string, string][];
			const effectiveNotes = notes ?? generalHelpNotes;
			const effectiveExamples = examples ?? generalHelpExamples;

			function printHelp(s: string) {
				if (banner) {
					console.log(`${banner}`);
				}
				console.log(s);
			}

			if (command) {
				cli
					.command("help", "Show help", {
						parameters: ["[command...]"],
						help: {
							notes: generalHelpNotes,
							examples: generalHelpExamples,
						},
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
							mergedFormatters,
							cli,
							cli._globalFlags,
							command,
							command ? command.help?.notes : effectiveNotes,
							command ? command.help?.examples : effectiveExamples,
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
							mergedFormatters,
							cli,
							cli._globalFlags,
							ctx.command,
							ctx.command ? ctx.command.help?.notes : effectiveNotes,
							ctx.command ? ctx.command.help?.examples : effectiveExamples,
						);
						printHelp(renderer.render());
					} else {
						const shouldShowHelp =
							showHelpWhenNoCommandSpecified &&
							!ctx.command && // no command resolved
							ctx.rawParsed.parameters.length === 0; // and no command supplied, means no root command defined

						if (shouldShowHelp) {
							const renderer = new HelpRenderer(
								mergedFormatters,
								cli,
								cli._globalFlags,
								undefined,
								effectiveNotes,
								effectiveExamples,
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
