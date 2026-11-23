import type { Theme } from "@clerc/theme";
import { createTheme, detectColor, detectUnicode } from "@clerc/theme";

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";
export type LogStyle = "rail" | "compact";
export type LogFormat = "pretty" | "json";
export type CalloutTone = "info" | "warn" | "error" | "success";

export interface CalloutOptions {
  readonly title: string;
  readonly lines?: readonly string[];
  readonly tone?: CalloutTone;
}

export interface LoggerTerminal {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
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
  step: (message: string, detail?: string) => void;
  info: (message: string, detail?: string) => void;
  success: (message: string, detail?: string) => void;
  warn: (message: string, detail?: string) => void;
  error: (message: string, detail?: string) => void;
  debug: (message: string, detail?: string) => void;
  raw: (text: string) => void;
  callout: (options: CalloutOptions) => void;
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
  }
> = {
  step: { level: "info", stderr: false, token: "brand", label: "step" },
  info: { level: "info", stderr: false, token: "info", label: "info" },
  success: { level: "info", stderr: false, token: "success", label: "done" },
  warn: { level: "warn", stderr: true, token: "warn", label: "warn" },
  error: { level: "error", stderr: true, token: "error", label: "error" },
  debug: { level: "debug", stderr: false, token: "muted", label: "debug" },
};

const CALLOUT_LABELS: Record<CalloutTone, string> = {
  info: "note",
  warn: "warn",
  error: "error",
  success: "done",
};

interface SharedLoggerState {
  level: LogLevel;
  style: LogStyle;
  format: LogFormat;
}

const identity = (text: string): string => text;

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
): string => formatLogLabel(label, theme[token]);

function createLoggerWithState(
  terminal: LoggerTerminal,
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

  function emit(kind: LogKind, message: string, detail?: string): void {
    const meta = KIND_META[kind];
    if (!shouldLog(meta.level)) {
      return;
    }

    const write = meta.stderr ? terminal.stderr : terminal.stdout;

    if (state.format === "json") {
      const payload: Record<string, unknown> = { level: kind, message };
      if (scope) {
        payload.scope = scope;
      }
      if (detail !== undefined) {
        payload.detail = detail;
      }
      write(JSON.stringify(payload));

      return;
    }

    const isDebug = kind === "debug";
    const label = formatLabel(meta.label, theme, meta.token);
    const scopePrefix = formatScope(isDebug);
    const body = isDebug
      ? faint(message)
      : kind === "step"
        ? theme.bold(message)
        : message;

    write(`${label}  ${scopePrefix}${body}`);
    if (detail !== undefined) {
      const prefix = detailPrefix();
      const formatDetail = isDebug ? faint : theme.muted;
      for (const line of detail.split("\n")) {
        write(`${prefix}${formatDetail(line)}`);
      }
    }
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
    callout: ({ title, lines = [], tone = "info" }) => {
      const meta = KIND_META[tone];
      if (!shouldLog(meta.level)) {
        return;
      }

      const write = meta.stderr ? terminal.stderr : terminal.stdout;

      if (state.format === "json") {
        write(JSON.stringify({ level: tone, title, lines }));

        return;
      }

      const label = formatLabel(CALLOUT_LABELS[tone], theme, meta.token);
      const prefix = detailPrefix();
      const output = [
        `${label}  ${theme.bold(title)}`,
        ...lines.map((line) => `${prefix}${theme.muted(line)}`),
      ];
      write(output.join("\n"));
    },
    withScope: (childScope) =>
      createLoggerWithState(
        terminal,
        theme,
        unicode,
        state,
        scope ? `${scope}:${childScope}` : childScope,
      ),
  };
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const terminal = options.terminal ?? DEFAULT_TERMINAL;
  const color = options.color ?? terminal.color ?? detectColor();
  const unicode = options.unicode ?? terminal.unicode ?? detectUnicode();
  const theme = options.theme ?? createTheme(color);
  const state: SharedLoggerState = {
    level: options.level ?? "info",
    style: options.style ?? "rail",
    format: options.format ?? "pretty",
  };

  return createLoggerWithState(terminal, theme, unicode, state, options.scope);
}
