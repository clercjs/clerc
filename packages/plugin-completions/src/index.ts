import { RootCommand } from "@bomb.sh/tab";
import { ClercError, Types, plugin } from "clerc";

import type {
  ArgCompletionMeta,
  CommandCompletionMeta,
  CompletionMeta,
  FlagCompletionMeta,
} from "./t";
import { buildTabModel } from "./t";

export type {
  ArgCompletionMeta,
  CommandCompletionMeta,
  CompletionMeta,
  FlagCompletionMeta,
};

declare module "clerc" {
  interface CommandCustomMeta {
    readonly completions?: CommandCompletionMeta;
  }
  interface FlagCustomMeta {
    readonly completions?: FlagCompletionMeta;
  }
  interface ArgCustomMeta {
    readonly completions?: ArgCompletionMeta;
  }
}

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
              code: "ERR_MISSING_ARGUMENT",
              exitCode: 2,
              hints: [
                `run '${ctx.meta.name} completions zsh' or pass '--shell zsh'`,
              ],
            },
          );
        }

        const t = new RootCommand();
        buildTabModel(t, ctx.model);
        t.setup(ctx.meta.name, ctx.meta.name, shell);
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
