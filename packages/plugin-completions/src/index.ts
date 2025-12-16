import type {
	ArgumentHandler,
	Command as TabCommand,
	OptionHandler,
} from "@bomb.sh/tab";
import t from "@bomb.sh/tab";
import type { Plugin } from "@clerc/core";
import { Types, definePlugin } from "@clerc/core";

import { buildTabModel } from "./t";

declare module "@clerc/core" {
	export interface CommandCustomOptions {
		/**
		 * Completions options for the command.
		 */
		completions?: {
			/**
			 * Whether to show the command in completions output.
			 *
			 * @default true
			 */
			show?: boolean;
			/**
			 * Handler to provide custom completions for the command.
			 */
			handler?: (command: TabCommand) => void;
		};
	}
	export interface FlagCustomOptions {
		/**
		 * Completions options for the flag.
		 */
		completions?: {
			/**
			 * Whether to show the flag in completions output.
			 *
			 * @default true
			 */
			show?: boolean;
			/**
			 * Handler to provide custom completions for the flag.
			 */
			handler?: OptionHandler;
		};
	}
	export interface ParameterCustomOptions {
		/**
		 * Completions options for the parameter.
		 */
		completions?: {
			/**
			 * Handler to provide custom completions for the parameter.
			 */
			handler?: ArgumentHandler;
		};
	}
}

export const completionsPlugin = (): Plugin =>
	definePlugin({
		setup: (cli) => {
			const supportedShellEnum = Types.Enum(
				"zsh",
				"bash",
				"fish",
				"powershell",
			);

			cli
				.command("completions", "Generate shell completion scripts", {
					flags: {
						shell: {
							description: "Shell type",
							type: supportedShellEnum,
						},
					},
					parameters: [
						{
							key: "[shell]",
							description: "Shell type",
							type: supportedShellEnum,
						},
					],
				})
				.on("completions", async (ctx) => {
					const shell = ctx.parameters.shell ?? ctx.flags.shell;

					if (!shell) {
						throw new Error(
							"Shell type is required. Please provide it via --shell flag or [shell] parameter.",
						);
					}

					buildTabModel(cli._globalFlags, cli._commands);

					t.setup(cli._scriptName, cli._scriptName, shell);
				});

			cli
				.command("complete", {
					help: { show: false },
					completions: { show: false },
					parameters: ["--", "[input...]"],
				})
				.on("complete", async (ctx) => {
					buildTabModel(cli._globalFlags, cli._commands);

					const { input } = ctx.parameters;
					t.parse(input);
				});

			return cli;
		},
	});
