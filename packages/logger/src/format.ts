import { inspect } from "node:util";

import type { Theme, ThemeToken } from "@clerc/theme";

import type { LogKind, LogLevel } from "./types";

export const LOG_LABEL_WIDTH = 5;
export const LOG_GUTTER = " ".repeat(LOG_LABEL_WIDTH + 1);

export const KIND_META: Record<
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

const identity = (text: string): string => text;

export const formatLogLabel = (
  label: string,
  style: (text: string) => string = identity,
): string =>
  `${" ".repeat(Math.max(0, LOG_LABEL_WIDTH - label.length))}${style(label)}`;

export const formatLabel = (
  label: string,
  theme: Theme,
  token: ThemeToken,
  bold: boolean,
): string =>
  formatLogLabel(label, (text) =>
    bold ? theme.bold(theme[token](text)) : theme[token](text),
  );

const errorHeader = (err: Error): string =>
  err.message.length > 0 ? `${err.name}: ${err.message}` : err.name;

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

export function formatDetailLines(
  value: unknown,
  isDebug: boolean,
  theme: Theme,
  color: boolean,
  faint: (text: string) => string,
): string[] {
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

export function resolvePayload(
  isDebug: boolean,
  rawMessage: unknown,
  rawDetails: readonly unknown[],
  theme: Theme,
  color: boolean,
  faint: (text: string) => string,
): {
  readonly headline: string;
  readonly extraLines: readonly string[];
} {
  const detailLines = rawDetails.flatMap((value) =>
    formatDetailLines(value, isDebug, theme, color, faint),
  );

  if (typeof rawMessage === "string") {
    return {
      headline: rawMessage,
      extraLines: detailLines,
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
  };
}
