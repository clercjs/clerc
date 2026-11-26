import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { CliModel } from "clerc";

import type { SupportedShell } from "./shells";
import { renderCompletionScript } from "./shells";

export interface ResolveInstallPlanOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly homeDir?: string;
  readonly platform?: NodeJS.Platform;
}

export interface CompletionInstallPlan {
  readonly shell: SupportedShell;
  readonly scriptPath: string;
  readonly rcPath?: string;
  readonly rcBlock?: string;
  readonly markerStart: string;
  readonly markerEnd: string;
  readonly reloadHint: string;
}

export interface InstallCompletionsOptions extends ResolveInstallPlanOptions {
  readonly shell: SupportedShell;
  readonly model: CliModel;
  readonly executable?: string;
  readonly dryRun?: boolean;
}

export interface InstallCompletionsResult {
  readonly shell: SupportedShell;
  readonly scriptPath: string;
  readonly rcPath?: string;
  readonly rcUpdated: boolean;
  readonly reloadHint: string;
  readonly dryRun: boolean;
}

export interface UninstallCompletionsOptions extends ResolveInstallPlanOptions {
  readonly shell: SupportedShell;
  readonly name: string;
  readonly dryRun?: boolean;
}

export interface UninstallCompletionsResult {
  readonly shell: SupportedShell;
  readonly scriptPath: string;
  readonly rcPath?: string;
  readonly scriptRemoved: boolean;
  readonly rcUpdated: boolean;
  readonly dryRun: boolean;
}

const shDoubleQuote = (value: string): string =>
  `"${value.replace(/[\\"$`]/g, "\\$&")}"`;

const psSingleQuote = (value: string): string =>
  `'${value.replace(/'/g, "''")}'`;

const sanitizeFileName = (name: string): string =>
  name.replace(/[^\w.-]/g, "_") || "cli";

const nonEmpty = (value?: string): string | undefined =>
  value && value.length > 0 ? value : undefined;

export function detectShell(
  env: Readonly<Record<string, string | undefined>> = process.env,
): SupportedShell | undefined {
  const rawShell = env.SHELL?.trim();
  if (rawShell) {
    const base = rawShell
      .split(/[\\/]/)
      .at(-1)
      ?.replace(/\.exe$/i, "")
      .toLowerCase();
    if (base === "zsh" || base === "bash" || base === "fish") {
      return base;
    }
    if (base === "pwsh" || base === "powershell") {
      return "powershell";
    }
  }

  if (env.ZSH_VERSION) {
    return "zsh";
  }
  if (env.FISH_VERSION) {
    return "fish";
  }
  if (env.BASH_VERSION) {
    return "bash";
  }
  if (env.PSModulePath) {
    return "powershell";
  }

  return undefined;
}

export function resolveInstallPlan(
  shell: SupportedShell,
  name: string,
  options: ResolveInstallPlanOptions = {},
): CompletionInstallPlan {
  const env = options.env ?? process.env;
  const home = options.homeDir ?? env.HOME ?? env.USERPROFILE ?? homedir();
  const platform = options.platform ?? process.platform;
  const safeName = sanitizeFileName(name);
  const markerStart = `# >>> ${name} completions >>>`;
  const markerEnd = `# <<< ${name} completions <<<`;

  switch (shell) {
    case "fish": {
      const configHome = nonEmpty(env.XDG_CONFIG_HOME) ?? join(home, ".config");
      const scriptPath = join(
        configHome,
        "fish",
        "completions",
        `${safeName}.fish`,
      );

      return {
        shell,
        scriptPath,
        markerStart,
        markerEnd,
        reloadHint: "Completions take effect automatically in Fish.",
      };
    }

    case "zsh": {
      const dataHome =
        nonEmpty(env.XDG_DATA_HOME) ?? join(home, ".local", "share");
      const completionsDir = join(dataHome, "zsh", "site-functions");
      const scriptPath = join(completionsDir, `_${safeName}`);
      const rcPath = join(nonEmpty(env.ZDOTDIR) ?? home, ".zshrc");
      const quotedScript = shDoubleQuote(scriptPath);
      const quotedDir = shDoubleQuote(completionsDir);
      const rcBlock = [
        markerStart,
        `if [ -f ${quotedScript} ]; then`,
        "  if (( $+functions[compdef] )); then",
        `    source ${quotedScript}`,
        "  else",
        `    fpath=(${quotedDir} $fpath)`,
        "  fi",
        "fi",
        markerEnd,
      ].join("\n");

      return {
        shell,
        scriptPath,
        rcPath,
        rcBlock,
        markerStart,
        markerEnd,
        reloadHint: `Restart your shell or run: source ${shDoubleQuote(rcPath)}`,
      };
    }

    case "bash": {
      const bashCompDir =
        nonEmpty(env.BASH_COMPLETION_USER_DIR) ??
        join(
          nonEmpty(env.XDG_DATA_HOME) ?? join(home, ".local", "share"),
          "bash-completion",
        );
      const scriptPath = join(bashCompDir, "completions", safeName);
      const rcPath = join(
        home,
        platform === "darwin" ? ".bash_profile" : ".bashrc",
      );
      const quotedScript = shDoubleQuote(scriptPath);
      const rcBlock = [
        markerStart,
        `[ -f ${quotedScript} ] && . ${quotedScript}`,
        markerEnd,
      ].join("\n");

      return {
        shell,
        scriptPath,
        rcPath,
        rcBlock,
        markerStart,
        markerEnd,
        reloadHint: `Restart your shell or run: source ${shDoubleQuote(rcPath)}`,
      };
    }

    case "powershell": {
      const rcPath =
        nonEmpty(env.PROFILE) ??
        (platform === "win32"
          ? join(
              home,
              "Documents",
              "PowerShell",
              "Microsoft.PowerShell_profile.ps1",
            )
          : join(
              nonEmpty(env.XDG_CONFIG_HOME) ?? join(home, ".config"),
              "powershell",
              "Microsoft.PowerShell_profile.ps1",
            ));
      const scriptPath = join(
        dirname(rcPath),
        "completions",
        `${safeName}.ps1`,
      );
      const quotedScript = psSingleQuote(scriptPath);
      const rcBlock = [
        markerStart,
        `if (Test-Path ${quotedScript}) { . ${quotedScript} }`,
        markerEnd,
      ].join("\n");

      return {
        shell,
        scriptPath,
        rcPath,
        rcBlock,
        markerStart,
        markerEnd,
        reloadHint: `Restart PowerShell or run: . ${psSingleQuote(rcPath)}`,
      };
    }
  }
}

function findMarkedRange(
  lines: readonly string[],
  markerStart: string,
  markerEnd: string,
): readonly [start: number, end: number] | undefined {
  const start = lines.findIndex(
    (line) => line.replace(/\r$/, "") === markerStart,
  );
  if (start === -1) {
    return undefined;
  }
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].replace(/\r$/, "") === markerEnd) {
      return [start, i];
    }
  }

  return undefined;
}

function upsertMarkedBlock(
  content: string,
  markerStart: string,
  markerEnd: string,
  block: string,
): { readonly content: string; readonly changed: boolean } {
  const lines = content.split("\n");
  const range = findMarkedRange(lines, markerStart, markerEnd);
  if (range) {
    const [start, end] = range;
    const next = [
      ...lines.slice(0, start),
      ...block.split("\n"),
      ...lines.slice(end + 1),
    ].join("\n");

    return { content: next, changed: next !== content };
  }

  if (content.trim().length === 0) {
    return { content: `${block}\n`, changed: true };
  }

  const sep = content.endsWith("\n\n")
    ? ""
    : content.endsWith("\n")
      ? "\n"
      : "\n\n";

  return { content: `${content}${sep}${block}\n`, changed: true };
}

function removeMarkedBlock(
  content: string,
  markerStart: string,
  markerEnd: string,
): { readonly content: string; readonly changed: boolean } {
  const lines = content.split("\n");
  const range = findMarkedRange(lines, markerStart, markerEnd);
  if (!range) {
    return { content, changed: false };
  }

  let [start, end] = range;
  if (start > 0 && lines[start - 1].trim() === "") {
    start--;
  } else if (end + 1 < lines.length && lines[end + 1].trim() === "") {
    end++;
  }

  const remaining = [...lines.slice(0, start), ...lines.slice(end + 1)];
  const joined = remaining.join("\n");
  const next = joined.trim().length === 0 ? "" : joined;

  return { content: next, changed: next !== content };
}

async function readFileIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

export async function installCompletions(
  options: InstallCompletionsOptions,
): Promise<InstallCompletionsResult> {
  const { shell, model, executable, dryRun = false } = options;
  const plan = resolveInstallPlan(shell, model.meta.name, options);

  if (dryRun) {
    return {
      shell,
      scriptPath: plan.scriptPath,
      rcPath: plan.rcPath,
      rcUpdated: Boolean(plan.rcPath),
      reloadHint: plan.reloadHint,
      dryRun: true,
    };
  }

  const script = renderCompletionScript(shell, model, executable);
  await mkdir(dirname(plan.scriptPath), { recursive: true });
  await writeFile(plan.scriptPath, `${script}\n`, "utf8");

  let rcUpdated = false;
  if (plan.rcPath && plan.rcBlock) {
    const existing = (await readFileIfExists(plan.rcPath)) ?? "";
    const updated = upsertMarkedBlock(
      existing,
      plan.markerStart,
      plan.markerEnd,
      plan.rcBlock,
    );
    if (updated.changed) {
      await mkdir(dirname(plan.rcPath), { recursive: true });
      await writeFile(plan.rcPath, updated.content, "utf8");
      rcUpdated = true;
    }
  }

  return {
    shell,
    scriptPath: plan.scriptPath,
    rcPath: plan.rcPath,
    rcUpdated,
    reloadHint: plan.reloadHint,
    dryRun: false,
  };
}

export async function uninstallCompletions(
  options: UninstallCompletionsOptions,
): Promise<UninstallCompletionsResult> {
  const { shell, name, dryRun = false } = options;
  const plan = resolveInstallPlan(shell, name, options);

  if (dryRun) {
    return {
      shell,
      scriptPath: plan.scriptPath,
      rcPath: plan.rcPath,
      scriptRemoved: true,
      rcUpdated: Boolean(plan.rcPath),
      dryRun: true,
    };
  }

  let scriptRemoved = false;
  try {
    await rm(plan.scriptPath);
    scriptRemoved = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  let rcUpdated = false;
  if (plan.rcPath) {
    const existing = await readFileIfExists(plan.rcPath);
    if (existing !== undefined) {
      const updated = removeMarkedBlock(
        existing,
        plan.markerStart,
        plan.markerEnd,
      );
      if (updated.changed) {
        await writeFile(plan.rcPath, updated.content, "utf8");
        rcUpdated = true;
      }
    }
  }

  return {
    shell,
    scriptPath: plan.scriptPath,
    rcPath: plan.rcPath,
    scriptRemoved,
    rcUpdated,
    dryRun: false,
  };
}
