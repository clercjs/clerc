import { RootCommand } from "@bomb.sh/tab";
import { ClercError, Types, plugin } from "clerc";

import { buildTabModel } from "./t";

export type { CompletionMeta } from "./t";

const supportedShellEnum = Types.Enum("zsh", "bash", "fish", "powershell");

export const completionsPlugin = () =>
  plugin("clerc:completions")
    .command("completions [shell]", {
      description: "Generate shell completion scripts",
      args: {
        shell: {
          description: "Shell type",
          type: supportedShellEnum,
        },
      },
      flags: {
        shell: {
          description: "Shell type",
          type: supportedShellEnum,
        },
      },
      run(ctx) {
        const shell = ctx.args.shell ?? ctx.flags.shell;

        if (!shell) {
          throw new ClercError(
            "shell type is required (zsh, bash, fish, or powershell)",
            {
              code: "ERR_MISSING_PARAMETER",
              exitCode: 2,
              hints: [
                `run '${ctx.meta.scriptName} completions zsh' or pass '--shell zsh'`,
              ],
            },
          );
        }

        const t = new RootCommand();
        buildTabModel(t, ctx.model);
        t.setup(ctx.meta.scriptName, ctx.meta.scriptName, shell);
      },
    })
    .command("complete -- [input...]", {
      hidden: true,
      run(ctx) {
        const t = new RootCommand();
        buildTabModel(t, ctx.model);
        t.parse(ctx.args.input);
      },
    });
