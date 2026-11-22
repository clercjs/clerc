import type { Terminal } from "./terminal";
import type { Theme, ThemeToken } from "./theme";

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";
export type LogStyle = "compact" | "rail";
export type LogFormat = "pretty" | "json";
export type CalloutTone = "info" | "warn" | "error" | "success";

export interface CalloutOptions {
  readonly title: string;
  readonly lines?: readonly string[];
  readonly tone?: CalloutTone;
}

export interface LoggerOptions {
  level?: LogLevel;
  style?: LogStyle;
  format?: LogFormat;
  scope?: string;
}

export interface CreateLoggerOptions extends LoggerOptions {
  readonly terminal: Terminal;
  readonly theme: Theme;
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

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

const KIND_META: Record<
  LogKind,
  {
    readonly level: Exclude<LogLevel, "silent">;
    readonly stderr: boolean;
    readonly token: ThemeToken;
  }
> = {
  step: { level: "info", stderr: false, token: "brand" },
  info: { level: "info", stderr: false, token: "info" },
  success: { level: "info", stderr: false, token: "success" },
  warn: { level: "warn", stderr: true, token: "warn" },
  error: { level: "error", stderr: true, token: "error" },
  debug: { level: "debug", stderr: false, token: "muted" },
};

interface SharedLoggerState {
  level: LogLevel;
  style: LogStyle;
  format: LogFormat;
}

const UNICODE_SYMBOLS = {
  step: "→",
  info: "ℹ",
  success: "✓",
  warn: "▲",
  error: "✖",
  debug: "·",
  bar: "│",
  railStep: "◆",
} as const;

const ASCII_SYMBOLS = {
  step: ">",
  info: "i",
  success: "+",
  warn: "!",
  error: "x",
  debug: ".",
  bar: "|",
  railStep: "*",
} as const;

function createLoggerWithState(
  terminal: Terminal,
  theme: Theme,
  state: SharedLoggerState,
  scope?: string,
): Logger {
  const symbols = terminal.unicode ? UNICODE_SYMBOLS : ASCII_SYMBOLS;

  const shouldLog = (targetLevel: Exclude<LogLevel, "silent">): boolean =>
    LEVEL_PRIORITY[state.level] >= LEVEL_PRIORITY[targetLevel];

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

    const rawSymbol =
      kind === "step" && state.style === "rail"
        ? symbols.railStep
        : symbols[kind];
    const glyph = theme[meta.token](rawSymbol);
    const scopeTag = scope ? `${theme.muted(`[${scope}]`)} ` : "";
    const body = kind === "debug" ? theme.muted(message) : message;
    const isRail = state.style === "rail";

    write(
      `${isRail ? "" : "  "}${glyph}${isRail ? "  " : " "}${scopeTag}${body}`,
    );
    if (detail !== undefined) {
      const prefix = isRail ? `${theme.muted(symbols.bar)}  ` : "    ";
      for (const line of detail.split("\n")) {
        write(`${prefix}${theme.muted(line)}`);
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

      const output = [
        `${theme[meta.token](symbols[tone])}  ${theme.bold(title)}`,
        ...lines.map((line) => `${theme.muted(symbols.bar)}  ${line}`),
      ];
      write(output.join("\n"));
    },
    withScope: (childScope) =>
      createLoggerWithState(
        terminal,
        theme,
        state,
        scope ? `${scope}:${childScope}` : childScope,
      ),
  };
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const state: SharedLoggerState = {
    level: options.level ?? "info",
    style: options.style ?? "compact",
    format: options.format ?? "pretty",
  };

  return createLoggerWithState(
    options.terminal,
    options.theme,
    state,
    options.scope,
  );
}
