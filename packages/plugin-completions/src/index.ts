import type { Command } from "clerc";
import { ClercError, Types, command } from "clerc";

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

export interface CompletionsOptions {
  /**
   * Executable command invoked by the generated shell completion script when
   * resolving dynamic `complete(ctx)` handlers. Defaults to
   * `ctx.model.meta.name`.
   */
  readonly executable?: string;
}

const supportedShellEnum = Types.Enum(...SUPPORTED_SHELLS);

const optionalShellArgs = {
  shell: {
    description: "Shell type (auto-detected if omitted)",
    type: supportedShellEnum,
  },
} as const;

const dryRunFlags = {
  dryRun: {
    type: Boolean,
    short: "n",
    description: "Show target files without modifying disk",
  },
} as const;

function resolveTargetShell(
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

export function completions(options: CompletionsOptions = {}): Command[] {
  const installCmd = command("install [shell]", {
    description: "Install shell completions",
    args: optionalShellArgs,
    flags: dryRunFlags,
    meta: { mcp: { enabled: false } },
    async run(ctx) {
      const shell = resolveTargetShell(
        ctx.args.shell,
        ctx.terminal.env,
        ctx.model.meta.name,
        "install",
      );
      if (ctx.flags.dryRun) {
        const plan = resolveInstallPlan(shell, ctx.model.meta.name, {
          env: ctx.terminal.env,
        });
        ctx.log.info(
          `Dry run: would install ${shell} completions`,
          `script: ${plan.scriptPath}`,
          ...(plan.rcPath ? [`rc: ${plan.rcPath}`] : []),
        );

        return;
      }

      const result = await installCompletions({
        shell,
        model: ctx.model,
        executable: options.executable,
        env: ctx.terminal.env,
      });
      ctx.log.success(
        `Installed ${shell} completions`,
        `script: ${result.scriptPath}`,
        ...(result.rcPath && result.rcUpdated
          ? [`updated: ${result.rcPath}`]
          : []),
      );
      ctx.log.info(result.reloadHint);
    },
  });

  const uninstallCmd = command("uninstall [shell]", {
    description: "Remove installed shell completions",
    args: optionalShellArgs,
    flags: dryRunFlags,
    meta: { mcp: { enabled: false } },
    async run(ctx) {
      const shell = resolveTargetShell(
        ctx.args.shell,
        ctx.terminal.env,
        ctx.model.meta.name,
        "uninstall",
      );
      if (ctx.flags.dryRun) {
        const plan = resolveInstallPlan(shell, ctx.model.meta.name, {
          env: ctx.terminal.env,
        });
        ctx.log.info(
          `Dry run: would remove ${shell} completions`,
          `script: ${plan.scriptPath}`,
          ...(plan.rcPath ? [`rc: ${plan.rcPath}`] : []),
        );

        return;
      }

      const result = await uninstallCompletions({
        shell,
        name: ctx.model.meta.name,
        env: ctx.terminal.env,
      });
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

  const completionsCmd = command("completions <shell>", {
    description: "Generate shell completion scripts",
    args: {
      shell: { description: "Shell type", type: supportedShellEnum },
    },
    commands: [installCmd, uninstallCmd],
    meta: { mcp: { enabled: false } },
    run(ctx) {
      ctx.terminal.stdout(
        renderCompletionScript(ctx.args.shell, ctx.model, options.executable),
      );
    },
  });

  const completeCmd = command("complete -- [input...]", {
    hidden: true,
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

  return [completionsCmd, completeCmd];
}
