import { ClercError, Complete, Types, plugin } from "clerc";

import { formatCompletionOutput, resolveCompletions } from "./complete";
import type { ResolveCompletionsOptions, ResolvedCompletions } from "./helpers";
import type {
  CompletionInstallPlan,
  InstallCompletionsOptions,
  InstallCompletionsResult,
  ResolveInstallPlanOptions,
  UninstallCompletionsOptions,
  UninstallCompletionsResult,
} from "./install";
import {
  detectShell,
  installCompletions,
  resolveInstallPlan,
  uninstallCompletions,
} from "./install";
import type { SupportedShell } from "./shells";
import {
  SUPPORTED_SHELLS,
  ShellCompDirective,
  renderCompletionScript,
} from "./shells";

export type {
  CompletionInstallPlan,
  InstallCompletionsOptions,
  InstallCompletionsResult,
  ResolveCompletionsOptions,
  ResolveInstallPlanOptions,
  ResolvedCompletions,
  SupportedShell,
  UninstallCompletionsOptions,
  UninstallCompletionsResult,
};
export {
  Complete,
  SUPPORTED_SHELLS,
  ShellCompDirective,
  detectShell,
  formatCompletionOutput,
  installCompletions,
  renderCompletionScript,
  resolveCompletions,
  resolveInstallPlan,
  uninstallCompletions,
};

export interface CompletionsPluginOptions {
  /**
   * Executable command invoked by the generated shell completion script when
   * resolving dynamic `complete(ctx)` handlers. Defaults to
   * `ctx.model.meta.name`.
   */
  readonly executable?: string;
}

const supportedShellEnum = Types.Enum(...SUPPORTED_SHELLS);

function requireTargetShell(
  explicitShell: SupportedShell | undefined,
  env: Readonly<Record<string, string | undefined>>,
  cliName: string,
  subcommand: "install" | "uninstall",
): SupportedShell {
  const shell = explicitShell ?? detectShell(env);
  if (!shell) {
    throw new ClercError("could not detect shell from environment", {
      code: "ERR_UNSUPPORTED_SHELL",
    }).addHint(
      `specify a shell explicitly: '${cliName} completions ${subcommand} <${SUPPORTED_SHELLS.join("|")}>'`,
    );
  }

  return shell;
}

export function completionsPlugin(options: CompletionsPluginOptions = {}) {
  const p = plugin("clerc:completions");
  const completions = p.subcommand("completions", {
    description: "Generate shell completion scripts",
  });

  completions
    .command("<shell>", {
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
          renderCompletionScript(ctx.args.shell, ctx.model, options.executable),
        );
      },
    })
    .command("install [shell]", {
      description: "Install shell completions",
      standalone: true,
      args: {
        shell: {
          description: "Shell type (auto-detected if omitted)",
          type: supportedShellEnum,
        },
      },
      flags: {
        dryRun: {
          type: Boolean,
          short: "n",
          description: "Show target files without modifying disk",
        },
      },
      async run(ctx) {
        const shell = requireTargetShell(
          ctx.args.shell,
          ctx.terminal.env,
          ctx.model.meta.name,
          "install",
        );
        const result = await installCompletions({
          shell,
          model: ctx.model,
          executable: options.executable,
          env: ctx.terminal.env,
          dryRun: ctx.flags.dryRun,
        });

        if (ctx.flags.dryRun) {
          ctx.log.info(
            `Dry run: would install ${shell} completions`,
            `script: ${result.scriptPath}`,
            ...(result.rcPath ? [`rc: ${result.rcPath}`] : []),
          );

          return;
        }

        ctx.log.success(
          `Installed ${shell} completions`,
          `script: ${result.scriptPath}`,
          ...(result.rcPath && result.rcUpdated
            ? [`updated: ${result.rcPath}`]
            : []),
        );
        ctx.log.info(result.reloadHint);
      },
    })
    .command("uninstall [shell]", {
      description: "Remove installed shell completions",
      standalone: true,
      args: {
        shell: {
          description: "Shell type (auto-detected if omitted)",
          type: supportedShellEnum,
        },
      },
      flags: {
        dryRun: {
          type: Boolean,
          short: "n",
          description: "Show target files without modifying disk",
        },
      },
      async run(ctx) {
        const shell = requireTargetShell(
          ctx.args.shell,
          ctx.terminal.env,
          ctx.model.meta.name,
          "uninstall",
        );
        const result = await uninstallCompletions({
          shell,
          name: ctx.model.meta.name,
          env: ctx.terminal.env,
          dryRun: ctx.flags.dryRun,
        });

        if (ctx.flags.dryRun) {
          ctx.log.info(
            `Dry run: would remove ${shell} completions`,
            `script: ${result.scriptPath}`,
            ...(result.rcPath ? [`rc: ${result.rcPath}`] : []),
          );

          return;
        }

        if (!result.scriptRemoved && !result.rcUpdated) {
          ctx.log.info(`No ${shell} completions found to remove`);

          return;
        }

        ctx.log.success(
          `Removed ${shell} completions`,
          ...(result.scriptRemoved ? [`removed: ${result.scriptPath}`] : []),
          ...(result.rcPath && result.rcUpdated
            ? [`updated: ${result.rcPath}`]
            : []),
        );
      },
    });

  p.command("complete -- [input...]", {
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

  return p;
}
