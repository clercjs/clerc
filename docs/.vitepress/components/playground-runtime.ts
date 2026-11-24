import type { Clerc } from "../../../packages/clerc/src/cli.ts";
import { createMemoryTerminal } from "../../../packages/clerc/src/terminal.ts";
import type { CliModel } from "../../../packages/clerc/src/types.ts";
import type { Logger } from "../../../packages/logger/src/index.ts";
import { createLogger } from "../../../packages/logger/src/index.ts";
import {
  ShellCompDirective,
  completionsPlugin,
  resolveCompletions,
} from "../../../packages/plugin-completions/src/index.ts";
import type { TerminalBlock } from "./terminal-render.ts";
import { parseAnsiLines } from "./terminal-render.ts";

export { completionsPlugin, createLogger };
export { clerc, plugin } from "../../../packages/clerc/src/cli.ts";
export { ClercError } from "../../../packages/clerc/src/errors.ts";
export { defaultHelpSections } from "../../../packages/clerc/src/help/renderer.ts";
export type { TypeFunction } from "../../../packages/clerc/src/schema.ts";
export { Types } from "../../../packages/clerc/src/schema.ts";

Error.isError ??= (val: unknown): val is Error => val instanceof Error;

export interface PromptOption {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
}

export interface ActivePrompt {
  readonly kind: "confirm" | "select" | "text";
  readonly message: string;
  readonly options?: readonly PromptOption[];
  readonly initialValue?: string | boolean;
  readonly placeholder?: string;
  readonly submit: (value: string | boolean) => void;
  readonly cancel: () => void;
}

export interface LiveRunContext {
  readonly signal: AbortSignal;
  readonly sleep: (ms: number) => Promise<void>;
  readonly setSpinner: (text: string | null) => void;
  readonly task: <T>(
    log: Logger,
    title: string,
    fn: (s: { readonly message: (msg: string) => void }) => Promise<T>,
    options?: { readonly errorMessage?: string },
  ) => Promise<T>;
  readonly select: <T extends string>(options: {
    readonly message: string;
    readonly options: readonly (PromptOption & { readonly value: T })[];
  }) => Promise<T | symbol>;
  readonly confirm: (options: {
    readonly message: string;
    readonly initialValue?: boolean;
  }) => Promise<boolean | symbol>;
  readonly text: (options: {
    readonly message: string;
    readonly placeholder?: string;
    readonly initialValue?: string;
  }) => Promise<string | symbol>;
  readonly isCancel: (value: unknown) => value is symbol;
}

export interface ManualSpinnerSpec {
  readonly startText: string;
  readonly messages: readonly string[];
  readonly stopText: string;
  readonly cancelText: string;
  readonly errorText: string;
}

export interface PlaygroundScenario {
  readonly createCli: (live?: LiveRunContext) => Clerc<any, any>;
  readonly source?: string;
  readonly presets: readonly {
    readonly cmd: string;
    readonly label?: string;
  }[];
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly live?: boolean;
  readonly manualSpinner?: ManualSpinnerSpec;
}

export const SPINNER_FRAMES = ["◒", "◐", "◓", "◑"] as const;

const CANCEL_SYMBOL = Symbol("clerc.playground.cancel");
const ABORT_ERROR = new Error("clerc.playground.abort");

export function tokenizeArgv(raw: string, binName: string): string[] {
  const prefixRe = new RegExp(`^(?:\\$\\s*)?(?:${binName}\\b\\s*)?`);
  const cleaned = raw.trim().replace(prefixRe, "");
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;

  for (const ch of cleaned) {
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

const toBlocks = (rawLines: readonly string[]): readonly TerminalBlock[] =>
  rawLines.length > 0
    ? parseAnsiLines(rawLines)
    : [
        {
          kind: "line",
          spans: [{ text: "(no output)", cls: "t-faint" }],
        },
      ];

export async function runScenarioCli(
  scenario: PlaygroundScenario,
  rawInput: string,
): Promise<{
  readonly exitCode: number;
  readonly blocks: readonly TerminalBlock[];
}> {
  const cli = scenario.createCli();
  const binName = cli.buildModel().meta.name;
  const argv = tokenizeArgv(rawInput, binName);
  const terminal = createMemoryTerminal({
    color: true,
    unicode: true,
    columns: 68,
    env: scenario.env,
  });

  const result = await cli.run(argv, { terminal });
  const rawLines = [...terminal.stdoutLines, ...terminal.stderrLines].flatMap(
    (chunk) => chunk.split("\n"),
  );

  return {
    exitCode: result.exitCode,
    blocks: toBlocks(rawLines),
  };
}

export async function runScenarioLive(
  scenario: PlaygroundScenario,
  rawInput: string,
  options: {
    readonly signal: AbortSignal;
    readonly onUpdate: (snapshot: {
      readonly blocks: readonly TerminalBlock[];
      readonly spinnerText: string | null;
      readonly prompt: ActivePrompt | null;
    }) => void;
  },
): Promise<{
  readonly exitCode: number;
  readonly blocks: readonly TerminalBlock[];
  readonly aborted: boolean;
}> {
  const { signal, onUpdate } = options;
  const rawLines: string[] = [];
  let spinnerText: string | null = null;
  let activePrompt: ActivePrompt | null = null;

  function emit() {
    if (signal.aborted) {
      return;
    }
    onUpdate({
      blocks: rawLines.length > 0 ? parseAnsiLines(rawLines) : [],
      spinnerText,
      prompt: activePrompt,
    });
  }

  const baseTerminal = createMemoryTerminal({
    color: true,
    unicode: true,
    columns: 68,
    env: scenario.env,
  });

  const streamingTerminal = {
    ...baseTerminal,
    stdout(text: string) {
      baseTerminal.stdout(text);
      rawLines.push(...text.split("\n"));
      emit();
    },
    stderr(text: string) {
      baseTerminal.stderr(text);
      rawLines.push(...text.split("\n"));
      emit();
    },
  };

  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(ABORT_ERROR);

        return;
      }
      let timer: ReturnType<typeof setTimeout>;
      function onAbort() {
        clearTimeout(timer);
        reject(ABORT_ERROR);
      }
      timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      signal.addEventListener("abort", onAbort, { once: true });
    });

  function setSpinner(text: string | null) {
    spinnerText = text;
    emit();
  }

  const openPrompt = <T extends string | boolean>(
    spec: Omit<ActivePrompt, "submit" | "cancel">,
    formatAnswer: (val: T) => string,
  ): Promise<T | symbol> =>
    new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(ABORT_ERROR);

        return;
      }
      function onAbort() {
        activePrompt = null;
        reject(ABORT_ERROR);
      }
      signal.addEventListener("abort", onAbort, { once: true });

      activePrompt = {
        ...spec,
        submit(val) {
          signal.removeEventListener("abort", onAbort);
          activePrompt = null;
          rawLines.push(
            `\u001B[32m◇\u001B[39m  \u001B[1m${spec.message}\u001B[22m`,
            `\u001B[90m│\u001B[39m  ${formatAnswer(val as T)}`,
          );
          emit();
          resolve(val as T);
        },
        cancel() {
          signal.removeEventListener("abort", onAbort);
          activePrompt = null;
          rawLines.push(
            `\u001B[31m■\u001B[39m  \u001B[1m${spec.message}\u001B[22m`,
            "\u001B[90m│\u001B[39m  \u001B[90mCancelled\u001B[39m",
          );
          emit();
          resolve(CANCEL_SYMBOL);
        },
      };
      emit();
    });

  const live: LiveRunContext = {
    signal,
    sleep,
    setSpinner,
    async task(log, title, fn, taskOptions) {
      const canShow =
        (log.level === "info" || log.level === "debug") &&
        log.format === "pretty";
      if (canShow) {
        setSpinner(title);
      }
      try {
        const result = await fn({
          message(msg) {
            if (canShow) {
              setSpinner(msg);
            }
          },
        });
        if (canShow) {
          setSpinner(null);
          const doneMsg =
            typeof result === "string" && result.length > 0
              ? result
              : title.replace(/\.+$/, "");
          log.success(doneMsg);
        }

        return result;
      } catch (error) {
        if (error === ABORT_ERROR) {
          throw error;
        }
        setSpinner(null);
        if (taskOptions?.errorMessage !== undefined) {
          log.error(taskOptions.errorMessage);
        }

        throw error;
      }
    },
    select: ({ message, options: opts }) =>
      openPrompt<any>(
        { kind: "select", message, options: opts },
        (val) => opts.find((o) => o.value === val)?.label ?? String(val),
      ),
    confirm: ({ message, initialValue = true }) =>
      openPrompt<boolean>({ kind: "confirm", message, initialValue }, (val) =>
        val ? "Yes" : "No",
      ),
    text: ({ message, placeholder, initialValue = "" }) =>
      openPrompt<string>(
        { kind: "text", message, placeholder, initialValue },
        (val) => val || "(empty)",
      ),
    isCancel: (val): val is symbol => val === CANCEL_SYMBOL,
  };

  const cli = scenario.createCli(live);
  const binName = cli.buildModel().meta.name;
  const argv = tokenizeArgv(rawInput, binName);

  emit();

  try {
    const result = await cli.run(argv, { terminal: streamingTerminal });
    if (signal.aborted) {
      return { exitCode: 0, blocks: [], aborted: true };
    }
    spinnerText = null;
    activePrompt = null;
    emit();

    return {
      exitCode: result.exitCode,
      blocks: toBlocks(rawLines),
      aborted: false,
    };
  } catch (error) {
    if (error === ABORT_ERROR || signal.aborted) {
      return { exitCode: 0, blocks: [], aborted: true };
    }

    throw error;
  }
}

export interface CompletionEntry {
  readonly value: string;
  readonly insert: string;
  readonly description?: string;
}

export interface CompletionQueryResult {
  readonly prefix: string;
  readonly items: readonly CompletionEntry[];
}

function splitCompletionInput(raw: string): {
  readonly prior: readonly string[];
  readonly current: string;
} {
  const trailingSpace = raw.length === 0 || /\s$/.test(raw);
  const trimmed = raw.trim();
  const parts = trimmed.length === 0 ? [] : trimmed.split(/\s+/);
  const prior = trailingSpace ? parts : parts.slice(0, -1);
  const current = trailingSpace ? "" : (parts.at(-1) ?? "");

  return { prior, current };
}

export async function resolvePlaygroundCompletions(
  model: CliModel,
  raw: string,
  env?: Readonly<Record<string, string | undefined>>,
): Promise<CompletionQueryResult> {
  const { prior, current } = splitCompletionInput(raw);
  const terminal = createMemoryTerminal({ env });
  let resolved = await resolveCompletions(model, [...prior, current], {
    terminal,
  });

  // When pressing Tab on an empty slot with no subcommands/positional candidates
  // left, surface available long flags from @clerc/plugin-completions.
  if (resolved.candidates.length === 0 && current.length === 0) {
    resolved = await resolveCompletions(model, [...prior, "--"], { terminal });
  }

  const isFileDirective =
    (resolved.directive &
      (ShellCompDirective.FilterFileExt | ShellCompDirective.FilterDirs)) !==
    0;
  if (isFileDirective) {
    return { prefix: current, items: [] };
  }

  const eqIdx = current.startsWith("-") ? current.indexOf("=") : -1;
  const replacePrefix = eqIdx === -1 ? current : current.slice(eqIdx + 1);
  const noSpace = (resolved.directive & ShellCompDirective.NoSpace) !== 0;

  return {
    prefix: replacePrefix,
    items: resolved.candidates.map((item) => ({
      value: item.value,
      insert: noSpace ? item.value : `${item.value} `,
      description:
        item.description && item.description.length > 0
          ? item.description
          : undefined,
    })),
  };
}

export function computeGhostSuffix(
  raw: string,
  query: CompletionQueryResult,
): string {
  if (raw.length === 0 || /\s$/.test(raw)) {
    return "";
  }
  const hit = query.items.find((item) => item.value !== query.prefix);

  return hit ? hit.insert.slice(query.prefix.length) : "";
}
