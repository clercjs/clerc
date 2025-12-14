import { writeFileSync } from "node:fs";

import t from "@bomb.sh/tab";
import type { ClercFlagsDefinition, Plugin } from "@clerc/core";
import { Types, definePlugin, normalizeFlagValue } from "@clerc/core";

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
	 * @deprecated `tab` does not require install/uninstall management commands.
	 * This option is kept for backward compatibility and has no effect.
	 */
	managementCommands?: boolean;
}

export const completionsPlugin = (
	options: CompletionsPluginOptions = {},
): Plugin =>
	definePlugin({
		setup: (cli) => {
			// kept for backwards compatibility; no longer used
			void options;

			cli.store.help?.addGroup({
				commands: [["completions", "Completions"]],
			});

			const supportedShellEnum = Types.Enum(
				"zsh",
				"bash",
				"fish",
				"powershell",
			);

			function resetTab() {
				// `t` is a singleton. Clear previous state to avoid duplicates across invocations.
				t.commands.clear();
				t.options.clear();
				t.arguments.clear();
				t.completions = [];
			}

			function pickShortAlias(value: unknown): string | undefined {
				if (!value) {
					return;
				}
				const aliases = Array.isArray(value) ? value : [value];
				for (const a of aliases) {
					if (typeof a === "string" && a.length === 1) {
						return a;
					}
				}
			}

			function isBooleanType(type: unknown): boolean {
				if (!type) {
					return true;
				}
				if (type === Boolean) {
					return true;
				}
				if (Array.isArray(type) && type.length === 1 && type[0] === Boolean) {
					return true;
				}

				return false;
			}

			function buildTabModel() {
				resetTab();

				// Global flags
				for (const [flagName, def] of Object.entries(
					cli._globalFlags as ClercFlagsDefinition,
				)) {
					const normalized = normalizeFlagValue(def);
					const desc = normalized.description ?? "";
					t.option(flagName, desc);
				}

				// Commands + command-level flags
				for (const cmd of cli._commands.values()) {
					if (cmd.completions?.show === false) {
						continue;
					}

					const command = t.command(cmd.name, cmd.description ?? "");
					const flags = cmd.flags ?? {};
					for (const [flagName, def] of Object.entries(flags)) {
						const normalized =
							typeof def === "function" || Array.isArray(def)
								? { type: def }
								: def;
						const short = pickShortAlias((normalized as any).alias);
						const desc = (normalized as any).description ?? "";
						const boolean = isBooleanType((normalized as any).type);
						if (boolean) {
							if (short) {
								command.option(flagName, desc, short);
							} else {
								command.option(flagName, desc);
							}
						} else {
							function handler() {}
							if (short) {
								command.option(flagName, desc, handler as any, short);
							} else {
								command.option(flagName, desc, handler as any);
							}
						}
					}
				}
			}

			cli
				.command("complete", "Generate shell completion scripts", {
					flags: {
						shell: {
							description: "Shell type",
							type: supportedShellEnum,
						},
					},
					parameters: [
						{
							key: "[shell]",
							description: "Shell type (zsh, bash, fish, powershell)",
							type: supportedShellEnum,
						},
						"--",
					],
				})
				.on("complete", async (ctx) => {
					const extra = ctx.rawParsed.doubleDash ?? [];
					writeFileSync(
						"debug.txt",
						`extra: ${JSON.stringify(extra)}\nctx.flags.shell: ${ctx.flags.shell}\nctx.parameters.shell: ${ctx.parameters.shell}\n`,
						{ flag: "a" },
					);

					const shell = ctx.parameters.shell ?? ctx.flags.shell;

					buildTabModel();

					if (shell) {
						// Generate shell script
						t.setup(cli._name, "node src/a.mjs", shell);

						return;
					}

					// Completion request (everything after `--`)
					t.parse(extra);
				});

			return cli;
		},
	});
