import { RootCommand } from "@bomb.sh/tab";
import { ClercError, Types, plugin } from "clerc";

import type {
  ArgCompletionMeta,
  CommandCompletionMeta,
  FlagCompletionMeta,
} from "./tab";
import { buildTabModel } from "./tab";

export type { ArgCompletionMeta, CommandCompletionMeta, FlagCompletionMeta };

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

        const root = new RootCommand();
        buildTabModel(root, ctx.model);
        root.setup(ctx.meta.name, ctx.meta.name, shell);
      },
    })
    .command("complete -- [input...]", {
      hidden: true,
      run(ctx) {
        const root = new RootCommand();
        buildTabModel(root, ctx.model);
        root.parse(ctx.args.input);
      },
    });
