import type { SpinnerOptions as ClackSpinnerOptions } from "@clack/prompts";
import type { Theme } from "@clerc/theme";

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

export type LogKind = keyof LogMethods;

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
