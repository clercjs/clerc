import type { Plugin } from "@clerc/core";
import { Types, definePlugin } from "@clerc/core";
import tabtab, { getShellFromEnv } from "@pnpm/tabtab";

import { getCompletion } from "./complete";

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
		};
	}
}

export interface CompletionsPluginOptions {
	/**
	 * Whether to register the `completions install` and `completions uninstall` commands.
	 * @default true
	 */
	managementCommands?: boolean;
}

export const completionsPlugin = (
	options: CompletionsPluginOptions = {},
): Plugin =>
	definePlugin({
		setup: (cli) => {
			const { managementCommands = true } = options;

			cli.store.help?.addGroup({
				commands: [["completions", "Completions"]],
			});

			const supportedShellEnum = Types.Enum(...tabtab.SUPPORTED_SHELLS);

			if (managementCommands) {
				cli
					.command("completions install", "Install shell completions", {
						help: {
							group: "completions",
						},
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
					.on("completions install", async (ctx) => {
						const shell = ctx.parameters.shell ?? ctx.flags.shell;
						if (!shell) {
							throw new Error(
								"Please specify the shell type via the --shell flag or the [shell] parameter.",
							);
						}
						if (!tabtab.SUPPORTED_SHELLS.includes(shell)) {
							throw new Error(
								`Unsupported shell: ${shell}. Supported shells are: ${tabtab.SUPPORTED_SHELLS.join(
									", ",
								)}.`,
							);
						}
						await tabtab.install({
							name: cli._scriptName,
							completer: cli._scriptName,
							shell,
						});
					});

				cli
					.command("completions uninstall", "Uninstall shell completions", {
						help: {
							group: "completions",
						},
					})
					.on("completions uninstall", async () => {
						await tabtab.uninstall({
							name: cli._scriptName,
						});
					});
			}

			cli
				.command("completions", "Generate completions script", {
					help: {
						group: "completions",
					},
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
							"Please specify the shell type via the --shell flag or the [shell] parameter.",
						);
					}
					if (!tabtab.SUPPORTED_SHELLS.includes(shell)) {
						throw new Error(
							`Unsupported shell: ${shell}. Supported shells are: ${tabtab.SUPPORTED_SHELLS.join(
								", ",
							)}.`,
						);
					}
					const script = await tabtab.getCompletionScript({
						name: cli._scriptName,
						completer: cli._scriptName,
						shell,
					});
					console.log(script);
				});

			cli
				.command("completion-server", "Handle completions", {
					help: {
						show: false,
					},
					completions: {
						show: false,
					},
				})
				.on("completion-server", async () => {
					const env = tabtab.parseEnv(process.env);
					if (!env.complete) {
						return;
					}

					const shell = getShellFromEnv(process.env);
					const candidates = await getCompletion(cli, env);

					const filtered = candidates.filter((c) =>
						c.name.startsWith(env.lastPartial),
					);

					tabtab.log(filtered, shell);
				});

			return cli;
		},
	});
