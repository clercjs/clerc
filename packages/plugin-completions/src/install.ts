import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { CliModel } from "clerc";

import type { SupportedShell } from "./shells";
import { renderCompletionScript } from "./shells";

export interface ResolveInstallPlanOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
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
}

export interface InstallCompletionsResult {
  readonly shell: SupportedShell;
  readonly scriptPath: string;
  readonly rcPath?: string;
  readonly rcUpdated: boolean;
  readonly reloadHint: string;
}

export interface UninstallCompletionsOptions extends ResolveInstallPlanOptions {
  readonly shell: SupportedShell;
  readonly name: string;
}

export interface UninstallCompletionsResult {
  readonly shell: SupportedShell;
  readonly scriptPath: string;
  readonly rcPath?: string;
  readonly scriptRemoved: boolean;
  readonly rcUpdated: boolean;
}

const shDoubleQuote = (value: string): string =>
  `"${value.replace(/[\\"$`]/g, "\\$&")}"`;

const psSingleQuote = (value: string): string =>
  `'${value.replace(/'/g, "''")}'`;

const envOr = (value: string | undefined, fallback: string): string =>
  value && value.length > 0 ? value : fallback;

export function detectShell(
  env: Readonly<Record<string, string | undefined>> = process.env,
): SupportedShell | undefined {
  const base = env.SHELL?.trim()
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
  const home = env.HOME ?? env.USERPROFILE ?? homedir();
  const safeName = name.replace(/[^\w.-]/g, "_");
  const markerStart = `# >>> ${name} completions >>>`;
  const markerEnd = `# <<< ${name} completions <<<`;
  const xdgConfig = envOr(env.XDG_CONFIG_HOME, join(home, ".config"));
  const xdgData = envOr(env.XDG_DATA_HOME, join(home, ".local", "share"));

  switch (shell) {
    case "fish": {
      return {
        shell,
        scriptPath: join(xdgConfig, "fish", "completions", `${safeName}.fish`),
        markerStart,
        markerEnd,
        reloadHint: "Completions take effect automatically in Fish.",
      };
    }

    case "zsh": {
      const completionsDir = join(xdgData, "zsh", "site-functions");
      const scriptPath = join(completionsDir, `_${safeName}`);
      const rcPath = join(envOr(env.ZDOTDIR, home), ".zshrc");
      const qScript = shDoubleQuote(scriptPath);
      const rcBlock = [
        markerStart,
        `if [ -f ${qScript} ]; then`,
        "  if (( $+functions[compdef] )); then",
        `    source ${qScript}`,
        "  else",
        `    fpath=(${shDoubleQuote(completionsDir)} $fpath)`,
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
      const bashCompDir = envOr(
        env.BASH_COMPLETION_USER_DIR,
        join(xdgData, "bash-completion"),
      );
      const scriptPath = join(bashCompDir, "completions", safeName);
      const rcPath = join(
        home,
        process.platform === "darwin" ? ".bash_profile" : ".bashrc",
      );
      const qScript = shDoubleQuote(scriptPath);

      return {
        shell,
        scriptPath,
        rcPath,
        rcBlock: [
          markerStart,
          `[ -f ${qScript} ] && . ${qScript}`,
          markerEnd,
        ].join("\n"),
        markerStart,
        markerEnd,
        reloadHint: `Restart your shell or run: source ${shDoubleQuote(rcPath)}`,
      };
    }

    case "powershell": {
      const rcPath = envOr(
        env.PROFILE,
        process.platform === "win32"
          ? join(
              home,
              "Documents",
              "PowerShell",
              "Microsoft.PowerShell_profile.ps1",
            )
          : join(xdgConfig, "powershell", "Microsoft.PowerShell_profile.ps1"),
      );
      const scriptPath = join(
        dirname(rcPath),
        "completions",
        `${safeName}.ps1`,
      );
      const qScript = psSingleQuote(scriptPath);

      return {
        shell,
        scriptPath,
        rcPath,
        rcBlock: [
          markerStart,
          `if (Test-Path ${qScript}) { . ${qScript} }`,
          markerEnd,
        ].join("\n"),
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
  const start = lines.indexOf(markerStart);
  if (start === -1) {
    return undefined;
  }
  const end = lines.indexOf(markerEnd, start + 1);

  return end === -1 ? undefined : [start, end];
}

function upsertMarkedBlock(
  content: string,
  markerStart: string,
  markerEnd: string,
  block: string,
): string | undefined {
  const lines = content.split("\n");
  const range = findMarkedRange(lines, markerStart, markerEnd);
  let next: string;
  if (range) {
    const [start, end] = range;
    next = [
      ...lines.slice(0, start),
      ...block.split("\n"),
      ...lines.slice(end + 1),
    ].join("\n");
  } else if (content.trim().length === 0) {
    next = `${block}\n`;
  } else {
    const sep = content.endsWith("\n\n")
      ? ""
      : content.endsWith("\n")
        ? "\n"
        : "\n\n";
    next = `${content}${sep}${block}\n`;
  }

  return next === content ? undefined : next;
}

function removeMarkedBlock(
  content: string,
  markerStart: string,
  markerEnd: string,
): string | undefined {
  const lines = content.split("\n");
  const range = findMarkedRange(lines, markerStart, markerEnd);
  if (!range) {
    return undefined;
  }

  let [start, end] = range;
  if (start > 0 && lines[start - 1].trim() === "") {
    start--;
  } else if (end + 1 < lines.length && lines[end + 1].trim() === "") {
    end++;
  }

  const joined = [...lines.slice(0, start), ...lines.slice(end + 1)].join("\n");
  const next = joined.trim().length === 0 ? "" : joined;

  return next === content ? undefined : next;
}

async function readIfExists(filePath: string): Promise<string | undefined> {
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
  const { shell, model, executable } = options;
  const plan = resolveInstallPlan(shell, model.meta.name, options);

  const script = renderCompletionScript(shell, model, executable);
  await mkdir(dirname(plan.scriptPath), { recursive: true });
  await writeFile(plan.scriptPath, `${script}\n`, "utf8");

  let rcUpdated = false;
  if (plan.rcPath && plan.rcBlock) {
    const existing = (await readIfExists(plan.rcPath)) ?? "";
    const next = upsertMarkedBlock(
      existing,
      plan.markerStart,
      plan.markerEnd,
      plan.rcBlock,
    );
    if (next !== undefined) {
      await mkdir(dirname(plan.rcPath), { recursive: true });
      await writeFile(plan.rcPath, next, "utf8");
      rcUpdated = true;
    }
  }

  return {
    shell,
    scriptPath: plan.scriptPath,
    rcPath: plan.rcPath,
    rcUpdated,
    reloadHint: plan.reloadHint,
  };
}

export async function uninstallCompletions(
  options: UninstallCompletionsOptions,
): Promise<UninstallCompletionsResult> {
  const { shell, name } = options;
  const plan = resolveInstallPlan(shell, name, options);

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
    const existing = await readIfExists(plan.rcPath);
    if (existing !== undefined) {
      const next = removeMarkedBlock(
        existing,
        plan.markerStart,
        plan.markerEnd,
      );
      if (next !== undefined) {
        await writeFile(plan.rcPath, next, "utf8");
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
  };
}
