import type { Theme } from "@clerc/theme";
import { createTheme, detectColor, detectUnicode } from "@clerc/theme";

import {
  KIND_META,
  LOG_GUTTER,
  LOG_LABEL_WIDTH,
  formatDetailLines,
  formatLabel,
  formatLogLabel,
  resolvePayload,
  stringifyJson,
} from "./format";
import type {
  CreateLoggerOptions,
  LogEntry,
  LogFormat,
  LogKind,
  LogLevel,
  LogMethods,
  Logger,
  LoggerTerminal,
} from "./types";
import { createLoggerSpinner, renderBoxLines } from "./widgets";

export { LOG_GUTTER, LOG_LABEL_WIDTH, formatLogLabel };
export type {
  CreateLoggerOptions,
  LogEntry,
  LogFormat,
  LogLevel,
  LogMethod,
  LogMethods,
  Logger,
  LoggerOptions,
  LoggerTerminal,
  SpinnerHandle,
  SpinnerOptions,
  TaskSpinner,
} from "./types";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

interface SharedLoggerState {
  level: LogLevel;
  format: LogFormat;
}

interface LoggerConfig {
  readonly terminal: LoggerTerminal;
  readonly color: boolean;
  readonly theme: Theme;
  readonly unicode: boolean;
  readonly state: SharedLoggerState;
}

const NOOP_ENTRY: LogEntry = Object.freeze({
  line: () => NOOP_ENTRY,
});

const DEFAULT_TERMINAL: LoggerTerminal = {
  stdout: (text) => process.stdout.write(`${text}\n`),
  stderr: (text) => process.stderr.write(`${text}\n`),
};

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

function createLoggerFromConfig(config: LoggerConfig, scope?: string): Logger {
  const { terminal, color, theme, unicode, state } = config;
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
          for (const part of formatDetailLines(
            value,
            isDebug,
            theme,
            color,
            faint,
          )) {
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
      theme,
      color,
      faint,
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

    write(`${label} ${scopePrefix}${body}`);
    for (const line of extraLines) {
      write(`${detailPrefix}${line}`);
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
      theme,
      color,
      faint,
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

    const streamColumns =
      terminal.columns ??
      (meta.stderr ? process.stderr.columns : process.stdout.columns) ??
      80;
    const rawLines = renderBoxLines({
      body: styledBody,
      title: styledTitle,
      columns: streamColumns,
      unicode,
      faint,
    });

    const label = formatLabel(meta.label, theme, meta.token, !isDebug);
    for (const [index, line] of rawLines.entries()) {
      write(`${index === 0 ? `${label} ` : LOG_GUTTER}${line}`);
    }
  }

  const createSpinner = (options?: Parameters<Logger["spinner"]>[0]) =>
    createLoggerSpinner({
      options,
      theme,
      unicode,
      noopEntry: NOOP_ENTRY,
      shouldLogInfo: () => shouldLog("info"),
      canAnimate: () =>
        shouldLog("info") &&
        terminal === DEFAULT_TERMINAL &&
        Boolean(process.stdout.isTTY) &&
        state.format === "pretty",
      formatScope: () => formatScope(false),
      emit,
    });

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
    box: bindLogMethods(emitBox),
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
          if (options?.errorMessage === undefined) {
            handle.clear();
          } else {
            handle.error(options.errorMessage);
          }
        }

        throw error;
      }
    },
    child: (childScope) =>
      createLoggerFromConfig(
        config,
        scope ? `${scope}:${childScope}` : childScope,
      ),
  };
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const terminal = options.terminal ?? DEFAULT_TERMINAL;
  const color = options.color ?? terminal.color ?? detectColor();

  return createLoggerFromConfig(
    {
      terminal,
      color,
      theme: options.theme ?? createTheme(color),
      unicode: options.unicode ?? terminal.unicode ?? detectUnicode(),
      state: {
        level: options.level ?? "info",
        format: options.format ?? "pretty",
      },
    },
    options.scope,
  );
}
