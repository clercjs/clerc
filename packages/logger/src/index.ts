import { Writable } from "node:stream";
import { inspect } from "node:util";

import type {
  BoxAlignment,
  SpinnerOptions as ClackSpinnerOptions,
} from "@clack/prompts";
import * as prompts from "@clack/prompts";
import type { Theme } from "@clerc/theme";
import { createTheme, detectColor, detectUnicode } from "@clerc/theme";

export { prompts };

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";
export type LogStyle = "rail" | "compact";
export type LogFormat = "pretty" | "json";
export type NoteTone = "info" | "warn" | "error" | "success";

export interface NoteOptions {
  readonly tone?: NoteTone;
  readonly contentAlign?: BoxAlignment;
  readonly titleAlign?: BoxAlignment;
  readonly width?: number | "auto";
  readonly rounded?: boolean;
  readonly stream?: "stdout" | "stderr";
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
  message: (message?: string) => void;
  stop: (message?: string) => void;
  error: (message?: string) => void;
  cancel: (message?: string) => void;
  clear: () => void;
  readonly isCancelled: boolean;
}

export interface LogEntry {
  readonly line: (value: unknown) => LogEntry;
}

export interface LoggerTerminal {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly isTTY?: boolean;
  readonly color?: boolean;
  readonly unicode?: boolean;
}

export type LoggerTheme = Pick<
  Theme,
  "brand" | "info" | "success" | "warn" | "error" | "muted" | "bold" | "dim"
>;

export interface LoggerOptions {
  level?: LogLevel;
  style?: LogStyle;
  format?: LogFormat;
  scope?: string;
}

export interface CreateLoggerOptions extends LoggerOptions {
  readonly terminal?: LoggerTerminal;
  readonly theme?: LoggerTheme;
  readonly color?: boolean;
  readonly unicode?: boolean;
}

export interface Logger {
  readonly level: LogLevel;
  readonly style: LogStyle;
  readonly format: LogFormat;
  readonly scope?: string;
  setLevel: (level: LogLevel) => void;
  setStyle: (style: LogStyle) => void;
  setFormat: (format: LogFormat) => void;
  step: (message: unknown, detail?: unknown) => LogEntry;
  info: (message: unknown, detail?: unknown) => LogEntry;
  success: (message: unknown, detail?: unknown) => LogEntry;
  warn: (message: unknown, detail?: unknown) => LogEntry;
  error: (message: unknown, detail?: unknown) => LogEntry;
  debug: (message: unknown, detail?: unknown) => LogEntry;
  raw: (text: string) => void;
  note: (message: string, title?: string, options?: NoteOptions) => void;
  spinner: (options?: SpinnerOptions) => SpinnerHandle;
  withScope: (scope: string) => Logger;
}

type LogKind = "step" | "info" | "success" | "warn" | "error" | "debug";
type LoggerThemeToken = keyof LoggerTheme;

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
    readonly token: LoggerThemeToken;
    readonly label: string;
    readonly boldLabel: boolean;
    readonly boldBody: boolean;
  }
> = {
  step: {
    level: "info",
    stderr: false,
    token: "brand",
    label: "step",
    boldLabel: true,
    boldBody: true,
  },
  info: {
    level: "info",
    stderr: false,
    token: "info",
    label: "info",
    boldLabel: true,
    boldBody: false,
  },
  success: {
    level: "info",
    stderr: false,
    token: "success",
    label: "done",
    boldLabel: true,
    boldBody: false,
  },
  warn: {
    level: "warn",
    stderr: true,
    token: "warn",
    label: "warn",
    boldLabel: true,
    boldBody: false,
  },
  error: {
    level: "error",
    stderr: true,
    token: "error",
    label: "error",
    boldLabel: true,
    boldBody: true,
  },
  debug: {
    level: "debug",
    stderr: false,
    token: "muted",
    label: "debug",
    boldLabel: false,
    boldBody: false,
  },
};

const NOTE_TONE_META: Record<
  NoteTone,
  {
    readonly level: Exclude<LogLevel, "silent">;
    readonly stderr: boolean;
    readonly token: LoggerThemeToken;
    readonly label: string;
  }
> = {
  info: { level: "info", stderr: false, token: "info", label: "note" },
  warn: { level: "warn", stderr: true, token: "warn", label: "warn" },
  error: { level: "error", stderr: true, token: "error", label: "error" },
  success: { level: "info", stderr: false, token: "success", label: "done" },
};

interface SharedLoggerState {
  level: LogLevel;
  style: LogStyle;
  format: LogFormat;
}

const identity = (text: string): string => text;

const NOOP_ENTRY: LogEntry = Object.freeze({
  line: () => NOOP_ENTRY,
});

const NOOP_SPINNER: SpinnerHandle = Object.freeze({
  start: () => {},
  message: () => {},
  stop: () => {},
  error: () => {},
  cancel: () => {},
  clear: () => {},
  isCancelled: false,
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
  theme: LoggerTheme,
  token: LoggerThemeToken,
  bold: boolean,
): string =>
  formatLogLabel(label, (text) =>
    bold ? theme.bold(theme[token](text)) : theme[token](text),
  );

function serializeJsonValue(value: unknown): unknown {
  if (Error.isError(value)) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...(value.cause === undefined
        ? {}
        : { cause: serializeJsonValue(value.cause) }),
    };
  }

  return value;
}

function extractStackFrames(err: Error): string[] {
  if (!err.stack) {
    return [];
  }
  const header =
    err.message.length > 0 ? `${err.name}: ${err.message}` : err.name;
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
    const summary =
      err.message.length > 0 ? `${err.name}: ${err.message}` : err.name;
    lines.push(styleSummary(summary));
  }
  for (const frame of extractStackFrames(err)) {
    lines.push(styleFrame(`  ${frame}`));
  }
  if (err.cause !== undefined && !seen.has(err.cause)) {
    if (Error.isError(err.cause)) {
      const causeSummary =
        err.cause.message.length > 0
          ? `${err.cause.name}: ${err.cause.message}`
          : err.cause.name;
      lines.push(styleSummary(`Caused by: ${causeSummary}`));
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
  theme: LoggerTheme,
  unicode: boolean,
  state: SharedLoggerState,
  scope?: string,
): Logger {
  const bar = unicode ? "│" : "|";
  const sep = unicode ? "›" : ">";
  const faint = (text: string): string => theme.dim(theme.muted(text));

  const shouldLog = (targetLevel: Exclude<LogLevel, "silent">): boolean =>
    LEVEL_PRIORITY[state.level] >= LEVEL_PRIORITY[targetLevel];

  const detailPrefix = (): string =>
    state.style === "rail" ? `${LOG_GUTTER}${faint(bar)} ` : LOG_GUTTER;

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
    if (isDebug) {
      return inspect(value, { colors: false, depth: 4 })
        .split("\n")
        .map((part) => faint(part));
    }

    return inspect(value, { colors: color, depth: 4 })
      .split("\n")
      .map((part) => theme.muted(part));
  }

  function createEntry(
    targetLevel: Exclude<LogLevel, "silent">,
    write: (text: string) => void,
    isDebug: boolean,
    jsonBase: Readonly<Record<string, unknown>>,
  ): LogEntry {
    const entry: LogEntry = {
      line(value) {
        if (!shouldLog(targetLevel)) {
          return entry;
        }
        if (state.format === "json") {
          write(
            JSON.stringify({
              ...jsonBase,
              ...(scope ? { scope } : {}),
              line: serializeJsonValue(value),
            }),
          );

          return entry;
        }
        const prefix = detailPrefix();
        for (const part of formatDetailLines(value, isDebug)) {
          write(`${prefix}${part}`);
        }

        return entry;
      },
    };

    return entry;
  }

  function emit(
    kind: LogKind,
    rawMessage: unknown,
    rawDetail?: unknown,
  ): LogEntry {
    const meta = KIND_META[kind];
    if (!shouldLog(meta.level)) {
      return NOOP_ENTRY;
    }

    const isDebug = kind === "debug";
    let messageText: string;
    let extraHeadlineLines: string[] | undefined;

    if (typeof rawMessage === "string") {
      messageText = rawMessage;
    } else if (Error.isError(rawMessage) && rawDetail === undefined) {
      messageText =
        rawMessage.message.length > 0 ? rawMessage.message : rawMessage.name;
      extraHeadlineLines = formatErrorLines(
        rawMessage,
        isDebug ? faint : theme.muted,
        faint,
        rawMessage.name !== "Error",
      );
    } else {
      const inspected = inspect(rawMessage, {
        colors: isDebug ? false : color,
        depth: 4,
      }).split("\n");
      messageText = inspected[0] ?? "";
      if (inspected.length > 1) {
        extraHeadlineLines = inspected
          .slice(1)
          .map((part) => (isDebug ? faint(part) : theme.muted(part)));
      }
    }

    const write = meta.stderr ? terminal.stderr : terminal.stdout;
    const jsonMessage =
      typeof rawMessage === "string"
        ? rawMessage
        : serializeJsonValue(rawMessage);
    const entry = createEntry(meta.level, write, isDebug, {
      level: kind,
      message: jsonMessage,
    });

    if (state.format === "json") {
      const payload: Record<string, unknown> = {
        level: kind,
        message: jsonMessage,
      };
      if (scope) {
        payload.scope = scope;
      }
      if (rawDetail !== undefined) {
        payload.detail = serializeJsonValue(rawDetail);
      }
      write(JSON.stringify(payload));

      return entry;
    }

    const label = formatLabel(meta.label, theme, meta.token, meta.boldLabel);
    const scopePrefix = formatScope(isDebug);
    const body = isDebug
      ? faint(messageText)
      : meta.boldBody
        ? theme.bold(messageText)
        : messageText;

    write(`${label}  ${scopePrefix}${body}`);
    if (extraHeadlineLines !== undefined && extraHeadlineLines.length > 0) {
      const prefix = detailPrefix();
      for (const line of extraHeadlineLines) {
        write(`${prefix}${line}`);
      }
    }
    if (rawDetail !== undefined) {
      entry.line(rawDetail);
    }

    return entry;
  }

  return {
    get level() {
      return state.level;
    },
    get style() {
      return state.style;
    },
    get format() {
      return state.format;
    },
    scope,
    setLevel: (level) => {
      state.level = level;
    },
    setStyle: (style) => {
      state.style = style;
    },
    setFormat: (format) => {
      state.format = format;
    },
    step: (msg, detail) => emit("step", msg, detail),
    info: (msg, detail) => emit("info", msg, detail),
    success: (msg, detail) => emit("success", msg, detail),
    warn: (msg, detail) => emit("warn", msg, detail),
    error: (msg, detail) => emit("error", msg, detail),
    debug: (msg, detail) => emit("debug", msg, detail),
    raw: (text) => {
      if (state.level !== "silent") {
        terminal.stdout(text);
      }
    },
    note: (message, title, options) => {
      const tone = options?.tone ?? "info";
      const meta = NOTE_TONE_META[tone];
      if (!shouldLog(meta.level)) {
        return;
      }
      const useStderr =
        options?.stream === undefined
          ? meta.stderr
          : options.stream === "stderr";
      const write = useStderr ? terminal.stderr : terminal.stdout;

      if (state.format === "json") {
        write(
          JSON.stringify({
            level: tone,
            ...(scope ? { scope } : {}),
            ...(title ? { title } : {}),
            message,
          }),
        );

        return;
      }

      const rawLines: string[] = [];
      const streamColumns =
        (useStderr ? process.stderr.columns : process.stdout.columns) ?? 80;
      const output = Object.assign(
        createLineWritable((line) => {
          rawLines.push(line);
        }),
        { columns: Math.max(40, streamColumns - LOG_GUTTER.length) },
      );

      const styledBody = message
        .split("\n")
        .map((line) => theme.muted(line))
        .join("\n");

      const headerParts: string[] = [];
      if (scope) {
        headerParts.push(`${theme.muted(scope)} ${faint(sep)}`);
      }
      if (title) {
        headerParts.push(theme.bold(title));
      }
      const styledTitle =
        headerParts.length > 0 ? ` ${headerParts.join(" ")} ` : undefined;

      prompts.box(styledBody, styledTitle, {
        output,
        withGuide: false,
        rounded: options?.rounded ?? unicode,
        width: options?.width ?? "auto",
        titlePadding: 1,
        contentPadding: 2,
        contentAlign: options?.contentAlign ?? "left",
        titleAlign: options?.titleAlign ?? "left",
        formatBorder: (ch) => {
          if (!unicode) {
            if (ch === "─") {
              return faint("-");
            }
            if (ch === "│") {
              return faint("|");
            }

            return faint("+");
          }

          return faint(ch);
        },
      });

      const label = formatLabel(meta.label, theme, meta.token, true);
      for (const [index, line] of rawLines.entries()) {
        write(`${index === 0 ? `${label}  ` : LOG_GUTTER}${line}`);
      }
    },
    spinner: (options) => {
      if (!shouldLog("info")) {
        return NOOP_SPINNER;
      }

      const canAnimate =
        isDefaultTerminal &&
        Boolean(process.stdout.isTTY) &&
        state.format === "pretty";

      if (canAnimate) {
        let cancelled = false;
        const scopePrefix = formatScope(false);
        const rawSpinner = prompts.spinner({
          ...options,
          output: process.stdout,
          withGuide: false,
          frames:
            options?.frames ??
            (unicode ? ["◒", "◐", "◓", "◑"] : ["-", "\\", "|", "/"]),
          styleFrame: (frame) =>
            formatLogLabel(frame, (s) => theme.bold(theme.brand(s))),
        });

        return {
          start(msg) {
            rawSpinner.start(
              msg ? `${scopePrefix}${msg}` : scopePrefix.trimEnd(),
            );
          },
          message(msg) {
            if (msg !== undefined) {
              rawSpinner.message(`${scopePrefix}${msg}`);
            }
          },
          stop(msg) {
            rawSpinner.clear();
            if (msg) {
              emit("success", msg);
            }
          },
          error(msg) {
            rawSpinner.clear();
            emit("error", msg ?? options?.errorMessage ?? "Failed");
          },
          cancel(msg) {
            cancelled = true;
            rawSpinner.clear();
            emit("warn", msg ?? options?.cancelMessage ?? "Cancelled");
          },
          clear() {
            rawSpinner.clear();
          },
          get isCancelled() {
            return cancelled || rawSpinner.isCancelled;
          },
        };
      }

      let cancelled = false;
      let activeEntry: LogEntry = NOOP_ENTRY;

      return {
        start(msg) {
          if (msg) {
            activeEntry = emit("step", msg);
          }
        },
        message(msg) {
          if (msg) {
            activeEntry.line(msg);
          }
        },
        stop(msg) {
          if (msg) {
            emit("success", msg);
          }
        },
        error(msg) {
          emit("error", msg ?? options?.errorMessage ?? "Failed");
        },
        cancel(msg) {
          cancelled = true;
          emit("warn", msg ?? options?.cancelMessage ?? "Cancelled");
        },
        clear() {},
        get isCancelled() {
          return cancelled;
        },
      };
    },
    withScope: (childScope) =>
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
    style: options.style ?? "rail",
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
