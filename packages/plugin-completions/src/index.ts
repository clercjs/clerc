import type { Plugin } from "@clerc/core";
import { definePlugin } from "@clerc/core";
import tabtab, { getShellFromEnv } from "@pnpm/tabtab";

import { getCompletion } from "./complete";

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

			if (managementCommands) {
				cli
					.command("completions install", "Install shell completions", {
						flags: {
							shell: {
								description: "Shell type",
								type: String,
							},
						},
						parameters: ["[shell]"],
					})
					.on("completions install", async (ctx) => {
						const shell = ctx.parameters.shell ?? ctx.flags.shell;
						if (!shell) {
							throw new Error(
								"Please specify the shell type via the --shell flag or the [shell] parameter.",
							);
						}
						if (!tabtab.SUPPORTED_SHELLS.includes(shell as any)) {
							throw new Error(
								`Unsupported shell: ${shell}. Supported shells are: ${tabtab.SUPPORTED_SHELLS.join(
									", ",
								)}.`,
							);
						}
						await tabtab.install({
							name: cli._name,
							completer: cli._name,
							shell: shell as any,
						});
					});

				cli
					.command("completions uninstall", "Uninstall shell completions")
					.on("completions uninstall", async () => {
						await tabtab.uninstall({
							name: cli._name,
						});
					});
			}

			cli
				.command("completions", "Generate completions script", {
					flags: {
						shell: {
							description: "Shell type",
							type: String,
						},
					},
					parameters: ["[shell]"],
				})
				.on("completions", async (ctx) => {
					const shell = ctx.parameters.shell ?? ctx.flags.shell;
					if (!shell) {
						throw new Error(
							"Please specify the shell type via the --shell flag or the [shell] parameter.",
						);
					}
					if (!tabtab.SUPPORTED_SHELLS.includes(shell as any)) {
						throw new Error(
							`Unsupported shell: ${shell}. Supported shells are: ${tabtab.SUPPORTED_SHELLS.join(
								", ",
							)}.`,
						);
					}
					const script = await tabtab.getCompletionScript({
						name: cli._name,
						completer: cli._name,
						shell: shell as any,
					});
					console.log(script);
				});

			cli
				.command("completion-server", "Handle completions")
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
