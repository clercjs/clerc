import { Writable } from "node:stream";
import { inspect } from "node:util";

import type { SpinnerOptions as ClackSpinnerOptions } from "@clack/prompts";
import * as prompts from "@clack/prompts";
import type { Theme, ThemeToken } from "@clerc/theme";
import { createTheme, detectColor, detectUnicode } from "@clerc/theme";

export { prompts };

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";
export type LogFormat = "pretty" | "json";

export interface LogEntry {
  readonly line: (...values: unknown[]) => LogEntry;
}

export type LogMethod<TReturn = void> = (
  message: unknown,
  ...details: unknown[]
) => TReturn;

export interface LogMethods<TReturn = LogEntry> {
  step: LogMethod<TReturn>;
  info: LogMethod<TReturn>;
  success: LogMethod<TReturn>;
  warn: LogMethod<TReturn>;
  error: LogMethod<TReturn>;
  debug: LogMethod<TReturn>;
}

export interface SpinnerOptions {
  readonly indicator?: ClackSpinnerOptions["indicator"];
  readonly cancelMessage?: string;
  readonly errorMessage?: string;
  readonly frames?: string[];
  readonly delay?: number;
  readonly signal?: AbortSignal;
}

export interface SpinnerHandle {
  start: (message?: string) => void;
  message: (message: string) => void;
  stop: (message?: string) => void;
  error: (message?: string) => void;
  cancel: (message?: string) => void;
  clear: () => void;
  readonly isCancelled: boolean;
}

export type TaskSpinner = Omit<SpinnerHandle, "start">;

export interface LoggerTerminal {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly isTTY?: boolean;
  readonly color?: boolean;
  readonly unicode?: boolean;
  readonly columns?: number;
}

export interface LoggerOptions {
  level?: LogLevel;
  format?: LogFormat;
  scope?: string;
}

export interface CreateLoggerOptions extends LoggerOptions {
  readonly terminal?: LoggerTerminal;
  readonly theme?: Theme;
  readonly color?: boolean;
  readonly unicode?: boolean;
}

export interface Logger extends LogMethods {
  level: LogLevel;
  format: LogFormat;
  readonly scope?: string;
  readonly theme: Theme;
  readonly box: LogMethods<void>;
  raw: (text?: string) => void;
  spinner: (options?: SpinnerOptions) => SpinnerHandle;
  task: <T>(
    title: string,
    fn: (spinner: TaskSpinner) => T | Promise<T>,
    options?: SpinnerOptions,
  ) => Promise<T>;
  child: (scope: string) => Logger;
}

type LogKind = keyof LogMethods;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export const LOG_LABEL_WIDTH = 5;
export const LOG_GUTTER = " ".repeat(LOG_LABEL_WIDTH + 2);

const KIND_META: Record<
  LogKind,
  {
    readonly level: Exclude<LogLevel, "silent">;
    readonly stderr: boolean;
    readonly token: ThemeToken;
    readonly label: string;
  }
> = {
  step: { level: "info", stderr: false, token: "brand", label: "step" },
  info: { level: "info", stderr: false, token: "info", label: "info" },
  success: { level: "info", stderr: false, token: "success", label: "done" },
  warn: { level: "warn", stderr: true, token: "warn", label: "warn" },
  error: { level: "error", stderr: true, token: "error", label: "error" },
  debug: { level: "debug", stderr: false, token: "muted", label: "debug" },
};

interface SharedLoggerState {
  level: LogLevel;
  format: LogFormat;
}

const identity = (text: string): string => text;

const NOOP_ENTRY: LogEntry = Object.freeze({
  line: () => NOOP_ENTRY,
});

const DEFAULT_TERMINAL: LoggerTerminal = {
  stdout: (text) => process.stdout.write(`${text}\n`),
  stderr: (text) => process.stderr.write(`${text}\n`),
};

export const formatLogLabel = (
  label: string,
  style: (text: string) => string = identity,
): string =>
  `${style(label)}${" ".repeat(Math.max(0, LOG_LABEL_WIDTH - label.length))}`;

const formatLabel = (
  label: string,
  theme: Theme,
  token: ThemeToken,
  bold: boolean,
): string =>
  formatLogLabel(label, (text) =>
    bold ? theme.bold(theme[token](text)) : theme[token](text),
  );

function stringifyJson(payload: Record<string, unknown>): string {
  const seen = new WeakSet<object>();

  return JSON.stringify(payload, (_key, value: unknown) => {
    if (typeof value === "bigint") {
      return String(value);
    }
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
      if (Error.isError(value)) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
          ...(value.cause === undefined ? {} : { cause: value.cause }),
        };
      }
    }

    return value;
  });
}

const errorHeader = (err: Error): string =>
  err.message.length > 0 ? `${err.name}: ${err.message}` : err.name;

const bindLogMethods = <T>(
  fn: (kind: LogKind, msg: unknown, ...details: unknown[]) => T,
): LogMethods<T> => ({
  step: (msg, ...details) => fn("step", msg, ...details),
  info: (msg, ...details) => fn("info", msg, ...details),
  success: (msg, ...details) => fn("success", msg, ...details),
  warn: (msg, ...details) => fn("warn", msg, ...details),
  error: (msg, ...details) => fn("error", msg, ...details),
  debug: (msg, ...details) => fn("debug", msg, ...details),
});

function extractStackFrames(err: Error): string[] {
  if (!err.stack) {
    return [];
  }
  const header = errorHeader(err);
  const rawBody = err.stack.startsWith(header)
    ? err.stack.slice(header.length)
    : err.stack;
  const frames = rawBody
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at "));
  const appFrames = frames.filter((line) => !line.includes("node:internal/"));

  return appFrames.length > 0 ? appFrames : frames;
}

function formatErrorLines(
  err: Error,
  styleSummary: (text: string) => string,
  styleFrame: (text: string) => string,
  includeHeader: boolean,
  seen = new Set<unknown>(),
): string[] {
  seen.add(err);
  const lines: string[] = [];
  if (includeHeader) {
    lines.push(styleSummary(errorHeader(err)));
  }
  for (const frame of extractStackFrames(err)) {
    lines.push(styleFrame(`  ${frame}`));
  }
  if (err.cause !== undefined && !seen.has(err.cause)) {
    if (Error.isError(err.cause)) {
      lines.push(styleSummary(`Caused by: ${errorHeader(err.cause)}`));
      lines.push(
        ...formatErrorLines(err.cause, styleSummary, styleFrame, false, seen),
      );
    } else {
      lines.push(
        styleSummary(
          `Caused by: ${inspect(err.cause, { colors: false, depth: 2 })}`,
        ),
      );
    }
  }

  return lines;
}

const createLineWritable = (writeLine: (text: string) => void): Writable =>
  new Writable({
    write(chunk, _encoding, callback) {
      const text = String(chunk).replace(/\n$/, "");
      if (text.length > 0) {
        for (const line of text.split("\n")) {
          writeLine(line);
        }
      }
      callback();
    },
  });

function createLoggerWithState(
  terminal: LoggerTerminal,
  isDefaultTerminal: boolean,
  color: boolean,
  theme: Theme,
  unicode: boolean,
  state: SharedLoggerState,
  scope?: string,
): Logger {
  const bar = unicode ? "│" : "|";
  const sep = unicode ? "›" : ">";
  const faint = (text: string): string => theme.dim(theme.muted(text));

  const shouldLog = (targetLevel: Exclude<LogLevel, "silent">): boolean =>
    LEVEL_PRIORITY[state.level] >= LEVEL_PRIORITY[targetLevel];

  const detailPrefix = `${LOG_GUTTER}${faint(bar)} `;

  function formatScope(isDebug: boolean): string {
    if (!scope) {
      return "";
    }

    return isDebug
      ? `${faint(`${scope} ${sep}`)} `
      : `${theme.muted(scope)} ${faint(sep)} `;
  }

  function formatDetailLines(value: unknown, isDebug: boolean): string[] {
    const styleSummary = isDebug ? faint : theme.muted;
    if (typeof value === "string") {
      return value.split("\n").map((part) => styleSummary(part));
    }
    if (Error.isError(value)) {
      return formatErrorLines(value, styleSummary, faint, true);
    }

    return inspect(value, { colors: !isDebug && color, depth: 4 })
      .split("\n")
      .map((part) => styleSummary(part));
  }

  function resolvePayload(
    isDebug: boolean,
    rawMessage: unknown,
    rawDetails: readonly unknown[],
  ): {
    readonly headline: string;
    readonly extraLines: readonly string[];
    readonly jsonMessage: unknown;
  } {
    const detailLines = rawDetails.flatMap((value) =>
      formatDetailLines(value, isDebug),
    );

    if (typeof rawMessage === "string") {
      return {
        headline: rawMessage,
        extraLines: detailLines,
        jsonMessage: rawMessage,
      };
    }

    if (Error.isError(rawMessage) && rawDetails.length === 0) {
      return {
        headline:
          rawMessage.message.length > 0 ? rawMessage.message : rawMessage.name,
        extraLines: formatErrorLines(
          rawMessage,
          isDebug ? faint : theme.muted,
          faint,
          rawMessage.name !== "Error",
        ),
        jsonMessage: rawMessage,
      };
    }

    const inspected = inspect(rawMessage, {
      colors: isDebug ? false : color,
      depth: 4,
    }).split("\n");

    return {
      headline: inspected[0] ?? "",
      extraLines: [
        ...inspected
          .slice(1)
          .map((part) => (isDebug ? faint(part) : theme.muted(part))),
        ...detailLines,
      ],
      jsonMessage: rawMessage,
    };
  }

  function createEntry(
    targetLevel: Exclude<LogLevel, "silent">,
    write: (text: string) => void,
    isDebug: boolean,
    jsonBase: Readonly<Record<string, unknown>>,
  ): LogEntry {
    const entry: LogEntry = {
      line(...values) {
        if (!shouldLog(targetLevel) || values.length === 0) {
          return entry;
        }
        if (state.format === "json") {
          for (const value of values) {
            write(
              stringifyJson({
                ...jsonBase,
                ...(scope ? { scope } : {}),
                line: value,
              }),
            );
          }

          return entry;
        }
        for (const value of values) {
          for (const part of formatDetailLines(value, isDebug)) {
            write(`${detailPrefix}${part}`);
          }
        }

        return entry;
      },
    };

    return entry;
  }

  function writeJsonRecord(
    write: (text: string) => void,
    kind: LogKind,
    jsonMessage: unknown,
    rawDetails: readonly unknown[],
  ): void {
    const payload: Record<string, unknown> = {
      level: kind,
      message: jsonMessage,
    };
    if (scope) {
      payload.scope = scope;
    }
    if (rawDetails.length === 1) {
      payload.detail = rawDetails[0];
    } else if (rawDetails.length > 1) {
      payload.details = rawDetails;
    }
    write(stringifyJson(payload));
  }

  function emit(
    kind: LogKind,
    rawMessage: unknown,
    ...rawDetails: unknown[]
  ): LogEntry {
    const meta = KIND_META[kind];
    if (!shouldLog(meta.level)) {
      return NOOP_ENTRY;
    }

    const isDebug = kind === "debug";
    const { headline, extraLines, jsonMessage } = resolvePayload(
      isDebug,
      rawMessage,
      rawDetails,
    );
    const write = meta.stderr ? terminal.stderr : terminal.stdout;
    const entry = createEntry(meta.level, write, isDebug, {
      level: kind,
      message: jsonMessage,
    });

    if (state.format === "json") {
      writeJsonRecord(write, kind, jsonMessage, rawDetails);

      return entry;
    }

    const label = formatLabel(meta.label, theme, meta.token, !isDebug);
    const scopePrefix = formatScope(isDebug);
    const body = isDebug
      ? faint(headline)
      : kind === "step" || kind === "error"
        ? theme.bold(headline)
        : headline;

    write(`${label}  ${scopePrefix}${body}`);
    if (extraLines.length > 0) {
      for (const line of extraLines) {
        write(`${detailPrefix}${line}`);
      }
    }

    return entry;
  }

  function emitBox(
    kind: LogKind,
    rawMessage: unknown,
    ...rawDetails: unknown[]
  ): void {
    const meta = KIND_META[kind];
    if (!shouldLog(meta.level)) {
      return;
    }

    const isDebug = kind === "debug";
    const { headline, extraLines, jsonMessage } = resolvePayload(
      isDebug,
      rawMessage,
      rawDetails,
    );
    const write = meta.stderr ? terminal.stderr : terminal.stdout;

    if (state.format === "json") {
      writeJsonRecord(write, kind, jsonMessage, rawDetails);

      return;
    }

    const hasDetailLines = extraLines.length > 0;
    const styledBody = hasDetailLines
      ? extraLines.join("\n")
      : (isDebug ? faint : theme.muted)(headline);

    const headerParts: string[] = [];
    if (scope) {
      headerParts.push(
        isDebug
          ? faint(`${scope} ${sep}`)
          : `${theme.muted(scope)} ${faint(sep)}`,
      );
    }
    if (hasDetailLines && headline.length > 0) {
      headerParts.push(isDebug ? faint(headline) : theme.bold(headline));
    }
    const styledTitle =
      headerParts.length > 0 ? ` ${headerParts.join(" ")} ` : undefined;

    const rawLines: string[] = [];
    const streamColumns =
      terminal.columns ??
      (meta.stderr ? process.stderr.columns : process.stdout.columns) ??
      80;
    const output = Object.assign(
      createLineWritable((line) => {
        rawLines.push(line);
      }),
      { columns: Math.max(40, streamColumns - LOG_GUTTER.length) },
    );

    prompts.box(styledBody, styledTitle, {
      output,
      withGuide: false,
      rounded: unicode,
      width: "auto",
      titlePadding: 1,
      contentPadding: 2,
      contentAlign: "left",
      titleAlign: "left",
      formatBorder: (ch) =>
        faint(unicode ? ch : ch === "─" ? "-" : ch === "│" ? "|" : "+"),
    });

    const label = formatLabel(meta.label, theme, meta.token, !isDebug);
    for (const [index, line] of rawLines.entries()) {
      write(`${index === 0 ? `${label}  ` : LOG_GUTTER}${line}`);
    }
  }

  const box = bindLogMethods(emitBox);

  function createSpinner(
    options?: SpinnerOptions,
  ): SpinnerHandle & { readonly active: boolean } {
    let active = false;
    let cancelled = false;
    let activeEntry: LogEntry = NOOP_ENTRY;

    const canAnimate = (): boolean =>
      shouldLog("info") &&
      isDefaultTerminal &&
      Boolean(process.stdout.isTTY) &&
      state.format === "pretty";

    let rawSpinner: ReturnType<typeof prompts.spinner> | undefined;

    function finish(): void {
      if (rawSpinner && active) {
        rawSpinner.clear();
      }
      active = false;
      activeEntry = NOOP_ENTRY;
    }

    return {
      start(msg = "") {
        finish();
        cancelled = false;
        if (!shouldLog("info")) {
          active = false;
          activeEntry = NOOP_ENTRY;

          return;
        }
        active = true;
        if (canAnimate()) {
          const scopePrefix = formatScope(false);
          rawSpinner ??= prompts.spinner({
            ...options,
            output: process.stdout,
            withGuide: false,
            frames:
              options?.frames ??
              (unicode ? ["◒", "◐", "◓", "◑"] : ["-", "\\", "|", "/"]),
            styleFrame: (frame) =>
              formatLogLabel(frame, (s) => theme.bold(theme.brand(s))),
          });
          rawSpinner.start(
            msg.length > 0 ? `${scopePrefix}${msg}` : scopePrefix.trimEnd(),
          );
        } else {
          rawSpinner = undefined;
          activeEntry = msg.length > 0 ? emit("step", msg) : NOOP_ENTRY;
        }
      },
      message(msg) {
        if (!active) {
          return;
        }
        if (rawSpinner) {
          rawSpinner.message(`${formatScope(false)}${msg}`);
        } else if (msg.length > 0) {
          activeEntry.line(msg);
        }
      },
      stop(msg) {
        finish();
        if (msg) {
          emit("success", msg);
        }
      },
      error(msg) {
        finish();
        emit("error", msg ?? options?.errorMessage ?? "Failed");
      },
      cancel(msg) {
        finish();
        cancelled = true;
        emit("warn", msg ?? options?.cancelMessage ?? "Cancelled");
      },
      clear: finish,
      get isCancelled() {
        return cancelled || Boolean(rawSpinner?.isCancelled);
      },
      get active() {
        return active;
      },
    };
  }

  return {
    get level() {
      return state.level;
    },
    set level(level) {
      state.level = level;
    },
    get format() {
      return state.format;
    },
    set format(format) {
      state.format = format;
    },
    scope,
    theme,
    ...bindLogMethods(emit),
    box,
    raw: (text = "") => {
      if (state.level !== "silent") {
        terminal.stdout(text);
      }
    },
    spinner: (options) => createSpinner(options),
    async task(title, fn, options) {
      const handle = createSpinner(options);
      handle.start(title);
      try {
        const result = await fn(handle);
        if (handle.active) {
          const doneMsg =
            typeof result === "string" && result.length > 0
              ? result
              : title.replace(/\.+$/, "");
          handle.stop(doneMsg);
        }

        return result;
      } catch (error) {
        if (handle.active) {
          handle.error(
            options?.errorMessage ??
              (Error.isError(error) ? error.message : String(error)),
          );
        }

        throw error;
      }
    },
    child: (childScope) =>
      createLoggerWithState(
        terminal,
        isDefaultTerminal,
        color,
        theme,
        unicode,
        state,
        scope ? `${scope}:${childScope}` : childScope,
      ),
  };
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const isDefaultTerminal = options.terminal === undefined;
  const terminal = options.terminal ?? DEFAULT_TERMINAL;
  const color = options.color ?? terminal.color ?? detectColor();
  const unicode = options.unicode ?? terminal.unicode ?? detectUnicode();
  const theme = options.theme ?? createTheme(color);
  const state: SharedLoggerState = {
    level: options.level ?? "info",
    format: options.format ?? "pretty",
  };

  return createLoggerWithState(
    terminal,
    isDefaultTerminal,
    color,
    theme,
    unicode,
    state,
    options.scope,
  );
}
