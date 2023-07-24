// TODO: unit tests
import { definePlugin } from "@clerc/core";

import { getBashCompletion, getPwshCompletion } from "./completions";

const completionMap = {
	bash: getBashCompletion,
	pwsh: getPwshCompletion,
};

export interface CompletionsPluginOptions {
	command?: boolean;
}
export const completionsPlugin = (options: CompletionsPluginOptions = {}) =>
	definePlugin({
		setup: (cli) => {
			const { command = true } = options;
			if (command) {
				cli = cli
					.command("completions", "Print shell completions to stdout", {
						flags: {
							shell: {
								description: "Shell type",
								type: String,
								default: "",
							},
						},
						parameters: ["[shell]"],
					})
					.on("completions", (context) => {
						if (!cli._scriptName) {
							throw new Error("CLI name is not defined!");
						}
						const shell = String(
							context.parameters.shell ?? context.flags.shell,
						);
						if (!shell) {
							throw new Error("Missing shell name");
						}
						if (shell in completionMap) {
							process.stdout.write(
								completionMap[shell as keyof typeof completionMap](context),
							);
						} else {
							throw new Error(`No such shell: ${shell}`);
						}
					});
			}

			return cli;
		},
	});
