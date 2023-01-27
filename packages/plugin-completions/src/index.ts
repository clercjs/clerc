
// TODO: unit tests
import { definePlugin } from "@clerc/core";
import { getBashCompletion, getPwshCompletion } from "./completions";

const completionMap = {
  bash: getBashCompletion,
  pwsh: getPwshCompletion,
};

export interface CompletionsPluginOptions {
  command?: boolean
}
export const completionsPlugin = (options: CompletionsPluginOptions = {}) => definePlugin({
  setup: (cli) => {
    const { command = true } = options;
    if (command) {
      cli = cli.command("completions", "Print shell completions to stdout", {
        flags: {
          shell: {
            description: "Shell type",
            type: String,
            default: "",
          },
        },
        parameters: [
          "[shell]",
        ],
      })
        .on("completions", (ctx) => {
          if (!cli._name) {
            throw new Error("CLI name is not defined!");
          }
          const shell = String(ctx.parameters.shell || ctx.flags.shell);
          if (!shell) {
            throw new Error("Missing shell name");
          }
          if (shell in completionMap) {
            // eslint-disable-next-line @so1ve/no-spaces-before-paren
            process.stdout.write(completionMap[shell as keyof typeof completionMap](ctx));
          } else {
            throw new Error(`No such shell: ${shell}`);
          }
        });
    }
    return cli;
  },
});
