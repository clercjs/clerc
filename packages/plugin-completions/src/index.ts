import { Types, plugin } from "clerc";

import { formatCompletionOutput, resolveCompletions } from "./complete";
import type { ResolveCompletionsOptions, ResolvedCompletions } from "./helpers";
import type { SupportedShell } from "./shells";
import {
  SUPPORTED_SHELLS,
  ShellCompDirective,
  renderCompletionScript,
} from "./shells";

export type { ResolveCompletionsOptions, ResolvedCompletions, SupportedShell };
export {
  SUPPORTED_SHELLS,
  ShellCompDirective,
  formatCompletionOutput,
  renderCompletionScript,
  resolveCompletions,
};

export interface CompletionsPluginOptions {
  /**
   * Executable command invoked by the generated shell completion script.
   * Defaults to `ctx.model.meta.name`.
   */
  readonly executable?: string;
}

const supportedShellEnum = Types.Enum(...SUPPORTED_SHELLS);

export const completionsPlugin = (options: CompletionsPluginOptions = {}) =>
  plugin("clerc:completions")
    .command("completions <shell>", {
      description: "Generate shell completion scripts",
      standalone: true,
      args: {
        shell: {
          description: "Shell type",
          type: supportedShellEnum,
        },
      },
      run(ctx) {
        ctx.terminal.stdout(
          renderCompletionScript(
            ctx.args.shell,
            ctx.model.meta.name,
            options.executable ?? ctx.model.meta.name,
          ),
        );
      },
    })
    .command("complete -- [input...]", {
      hidden: true,
      standalone: true,
      async run(ctx) {
        try {
          const resolved = await resolveCompletions(ctx.model, ctx.args.input, {
            terminal: ctx.terminal,
          });
          ctx.terminal.stdout(formatCompletionOutput(resolved));
        } catch {
          ctx.terminal.stdout(`:${ShellCompDirective.Error}`);
        }
      },
    });
