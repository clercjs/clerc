import { createRequire } from "node:module";
import type { Writable } from "node:stream";

import type { Theme } from "@clerc/theme";

import { LOG_GUTTER, LOG_LABEL_WIDTH } from "./format";
import type { LogEntry, LogKind, SpinnerHandle, SpinnerOptions } from "./types";

type ClackPrompts = typeof import("@clack/prompts");
let clackModule: ClackPrompts | undefined;

const loadClack = (): ClackPrompts =>
  (clackModule ??= createRequire(import.meta.url)(
    "@clack/prompts",
  ) as ClackPrompts);

export function renderBoxLines(options: {
  readonly body: string;
  readonly title?: string;
  readonly columns: number;
  readonly unicode: boolean;
  readonly faint: (text: string) => string;
}): string[] {
  const { body, title, columns, unicode, faint } = options;
  const rawLines: string[] = [];
  const output = {
    columns: Math.max(40, columns - LOG_GUTTER.length),
    write(chunk: string) {
      const text = chunk.replace(/\n$/, "");
      if (text.length > 0) {
        rawLines.push(...text.split("\n"));
      }

      return true;
    },
  } as unknown as Writable;

  loadClack().box(body, title, {
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

  return rawLines;
}

export function createLoggerSpinner(params: {
  readonly options?: SpinnerOptions;
  readonly theme: Theme;
  readonly unicode: boolean;
  readonly noopEntry: LogEntry;
  readonly shouldLogInfo: () => boolean;
  readonly canAnimate: () => boolean;
  readonly formatScope: () => string;
  readonly emit: (kind: LogKind, msg: unknown) => LogEntry;
}): SpinnerHandle & { readonly active: boolean } {
  const {
    options,
    theme,
    unicode,
    noopEntry,
    shouldLogInfo,
    canAnimate,
    formatScope,
    emit,
  } = params;
  let active = false;
  let cancelled = false;
  let activeEntry: LogEntry = noopEntry;
  let rawSpinner: ReturnType<ClackPrompts["spinner"]> | undefined;

  function finish(): void {
    if (rawSpinner && active) {
      rawSpinner.clear();
    }
    active = false;
    activeEntry = noopEntry;
  }

  return {
    start(msg = "") {
      finish();
      cancelled = false;
      if (!shouldLogInfo()) {
        active = false;
        activeEntry = noopEntry;

        return;
      }
      active = true;
      if (canAnimate()) {
        const scopePrefix = formatScope();
        rawSpinner ??= loadClack().spinner({
          ...options,
          output: process.stdout,
          withGuide: false,
          frames:
            options?.frames ??
            (unicode ? ["◒", "◐", "◓", "◑"] : ["-", "\\", "|", "/"]),
          styleFrame: (frame) =>
            `${" ".repeat(Math.max(0, LOG_LABEL_WIDTH - 1 - frame.length))}${theme.bold(theme.brand(frame))}`,
        });
        rawSpinner.start(
          msg.length > 0 ? `${scopePrefix}${msg}` : scopePrefix.trimEnd(),
        );
      } else {
        rawSpinner = undefined;
        activeEntry = msg.length > 0 ? emit("step", msg) : noopEntry;
      }
    },
    message(msg) {
      if (!active) {
        return;
      }
      if (rawSpinner) {
        rawSpinner.message(`${formatScope()}${msg}`);
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
