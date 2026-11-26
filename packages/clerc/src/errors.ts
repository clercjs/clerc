import { LOG_GUTTER, formatLogLabel } from "@clerc/logger";
import type { Theme } from "@clerc/theme";

import { formatCommandUsage } from "./help/document";
import { findClosest } from "./suggest";
import type { CliModel } from "./types";
import { formatFlagName, joinList } from "./utils";

export type BuiltinErrorCode =
  | "ERR_UNKNOWN_COMMAND"
  | "ERR_NO_COMMAND"
  | "ERR_MISSING_FLAG"
  | "ERR_MISSING_FLAG_VALUE"
  | "ERR_MISSING_ARGUMENT"
  | "ERR_UNEXPECTED_ARGUMENT"
  | "ERR_UNKNOWN_FLAG"
  | "ERR_VALIDATION"
  | "ERR_RULE_VIOLATION"
  | "ERR_INVALID_SCHEMA";

export type ClercErrorCode = BuiltinErrorCode | (string & {});

const BUILTIN_USAGE_EXIT_CODES = new Set<string>([
  "ERR_MISSING_ARGUMENT",
  "ERR_MISSING_FLAG",
  "ERR_MISSING_FLAG_VALUE",
  "ERR_NO_COMMAND",
  "ERR_RULE_VIOLATION",
  "ERR_UNEXPECTED_ARGUMENT",
  "ERR_UNKNOWN_COMMAND",
  "ERR_UNKNOWN_FLAG",
  "ERR_VALIDATION",
]);

export interface ValidationIssue {
  readonly message: string;
  readonly path?: readonly unknown[];
}

export interface ClercErrorOptions extends ErrorOptions {
  readonly code?: ClercErrorCode;
  readonly exitCode?: number;
  readonly detail?: string;
  readonly hints?: readonly string[];
  readonly usage?: string;
}

export class ClercError extends Error {
  public readonly code: ClercErrorCode;
  public readonly exitCode: number;
  public detail?: string;
  public readonly hints: string[];
  public usage?: string;

  constructor(message: string, options: ClercErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code ?? "ERR_CLI";
    this.exitCode =
      options.exitCode ?? (BUILTIN_USAGE_EXIT_CODES.has(this.code) ? 2 : 1);
    this.detail = options.detail;
    this.hints = options.hints ? [...options.hints] : [];
    this.usage = options.usage;
  }

  public addHint(hint: string): this {
    this.hints.push(hint);

    return this;
  }
}

export class ExitSignal extends Error {
  public readonly exitCode: number;

  constructor(exitCode = 1) {
    super(`Process exited with code ${exitCode}`);
    this.name = "ExitSignal";
    this.exitCode = exitCode;
  }
}

export class UnknownCommandError extends ClercError {
  public readonly commandName: string;
  public readonly parentPath: readonly string[];

  constructor(
    commandName: string,
    parentPath: readonly string[] = [],
    message = `unknown command '${commandName}'`,
  ) {
    super(message, {
      code: "ERR_UNKNOWN_COMMAND",
    });
    this.commandName = commandName;
    this.parentPath = parentPath;
  }
}

export class NoCommandError extends ClercError {
  constructor(message = "no command specified") {
    super(message, {
      code: "ERR_NO_COMMAND",
    });
  }
}

export class MissingRequiredFlagError extends ClercError {
  public readonly flags: readonly string[];

  constructor(flags: readonly string[], hints?: readonly string[]) {
    const formatted = flags.map(formatFlagName);
    const plural = flags.length > 1 ? "s" : "";
    super(
      `missing required option${plural}: ${formatted.map((f) => `'${f}'`).join(", ")}`,
      {
        code: "ERR_MISSING_FLAG",
        hints,
      },
    );
    this.flags = flags;
  }
}

export class MissingFlagValueError extends ClercError {
  public readonly flags: readonly string[];

  constructor(flags: readonly string[], hints?: readonly string[]) {
    const formatted = flags.map((f) => `'${formatFlagName(f)}'`);
    const plural = flags.length > 1;
    super(
      plural
        ? `options ${joinList(formatted)} require a value`
        : `option ${formatted[0]} requires a value`,
      {
        code: "ERR_MISSING_FLAG_VALUE",
        hints,
      },
    );
    this.flags = flags;
  }
}

export class UnexpectedArgumentError extends ClercError {
  public readonly args: readonly string[];

  constructor(args: readonly string[]) {
    const formatted = args.map((a) => `'${a}'`);
    const plural = args.length > 1 ? "s" : "";
    super(`unexpected argument${plural}: ${joinList(formatted)}`, {
      code: "ERR_UNEXPECTED_ARGUMENT",
    });
    this.args = args;
  }
}

export class MissingRequiredArgumentError extends ClercError {
  public readonly argument: string;
  public readonly isVariadic: boolean;

  constructor(argument: string, isVariadic = false, hints?: readonly string[]) {
    super(
      `missing required ${isVariadic ? "variadic " : ""}argument '<${argument}${isVariadic ? "..." : ""}>'`,
      {
        code: "ERR_MISSING_ARGUMENT",
        hints,
      },
    );
    this.argument = argument;
    this.isVariadic = isVariadic;
  }
}

export class UnknownFlagError extends ClercError {
  public readonly flags: readonly string[];

  constructor(flags: readonly string[], hints?: readonly string[]) {
    const formatted = flags.map((f) => `'${formatFlagName(f)}'`);
    const plural = flags.length > 1 ? "s" : "";
    super(`unexpected option${plural}: ${joinList(formatted)}`, {
      code: "ERR_UNKNOWN_FLAG",
      hints,
    });
    this.flags = flags;
  }
}

export class ValidationError extends ClercError {
  public readonly target: string;
  public readonly value: unknown;
  public readonly issues: readonly ValidationIssue[];

  constructor(
    target: string,
    value: unknown,
    issues: readonly ValidationIssue[],
    cause?: unknown,
  ) {
    const formattedValue =
      typeof value === "string" ? `'${value}'` : JSON.stringify(value);
    const detail = issues.map((i) => i.message).join("\n");
    super(`invalid value ${formattedValue} for '${target}'`, {
      code: "ERR_VALIDATION",
      detail,
      cause,
    });
    this.target = target;
    this.value = value;
    this.issues = issues;
  }
}

export interface RuleErrorOptions extends ErrorOptions {
  readonly detail?: string;
  readonly hints?: readonly string[];
  readonly exitCode?: number;
}

export class RuleError extends ClercError {
  constructor(message: string, options?: RuleErrorOptions) {
    super(message, {
      code: "ERR_RULE_VIOLATION",
      exitCode: options?.exitCode ?? 2,
      detail: options?.detail,
      hints: options?.hints,
      cause: options?.cause,
    });
  }
}

export class InvalidSchemaError extends ClercError {
  constructor(message: string) {
    super(`Invalid schema: ${message}`, {
      code: "ERR_INVALID_SCHEMA",
      exitCode: 1,
    });
  }
}

const COMMAND_DISTANCE_THRESHOLD = 4;

const USAGE_ERROR_CODES = new Set<ClercErrorCode>([
  "ERR_MISSING_ARGUMENT",
  "ERR_MISSING_FLAG",
  "ERR_MISSING_FLAG_VALUE",
  "ERR_RULE_VIOLATION",
  "ERR_UNEXPECTED_ARGUMENT",
]);

export function enrichCommandError(
  error: unknown,
  model: CliModel,
  commandPath: readonly string[] = [],
): void {
  if (!(error instanceof ClercError)) {
    return;
  }

  const { tree } = model;

  if (error instanceof NoCommandError) {
    const visible = tree
      .listVisibleChildren(tree.root)
      .map((node) => node.name);
    if (visible.length > 0 && error.hints.length === 0) {
      error.addHint(`available commands: ${visible.join(", ")}`);
    }

    return;
  }

  if (error instanceof UnknownCommandError && error.hints.length === 0) {
    const parentNode =
      error.parentPath.length > 0 ? tree.findNode(error.parentPath) : tree.root;
    const visible = tree.listVisibleChildren(parentNode);
    const candidates = visible.map((node) => node.fullPath.join(" "));
    if (candidates.length === 0) {
      return;
    }

    const match = findClosest(
      error.commandName,
      candidates,
      COMMAND_DISTANCE_THRESHOLD,
    );
    if (match) {
      error.addHint(`a similar command exists: '${match}'`);
    } else if (error.parentPath.length > 0) {
      error.addHint(
        `available subcommands: ${visible.map((node) => node.name).join(", ")}`,
      );
    }

    return;
  }

  if (error.usage === undefined && USAGE_ERROR_CODES.has(error.code)) {
    error.usage = formatCommandUsage(model, commandPath);
  }
}

export interface FormatDiagnosticOptions {
  readonly theme: Theme;
  readonly name?: string;
  readonly commandPath?: readonly string[];
  readonly verbose?: boolean;
  readonly showHelpHint?: boolean;
}

/**
 * Formats any error using Clerc v2 Cargo/Clap-inspired diagnostic style.
 */
export function formatDiagnostic(
  error: unknown,
  options: FormatDiagnosticOptions,
): string {
  const {
    theme,
    name,
    commandPath,
    verbose = false,
    showHelpHint = true,
  } = options;
  const message = Error.isError(error) ? error.message : String(error);
  const lines: string[] = [
    `${formatLogLabel("error", theme.error)} ${message}`,
  ];

  if (error instanceof ClercError) {
    if (error.detail) {
      for (const line of error.detail.split("\n")) {
        lines.push(`${LOG_GUTTER}${theme.muted(line)}`);
      }
    }

    if (error.hints.length > 0) {
      lines.push("");
      for (const hint of error.hints) {
        lines.push(
          `${formatLogLabel("tip", (s) => theme.bold(theme.accent(s)))} ${hint}`,
        );
      }
    }

    if (error.usage) {
      lines.push("");
      lines.push(`${formatLogLabel("usage", theme.bold)} ${error.usage}`);
    }

    if (showHelpHint && name && error.exitCode === 2) {
      const cmdPart =
        commandPath && commandPath.length > 0
          ? ` ${commandPath.join(" ")}`
          : "";
      lines.push("");
      lines.push(
        `${LOG_GUTTER}${theme.muted(
          `For more information, try '${name}${cmdPart} --help'.`,
        )}`,
      );
    }
  } else if (Error.isError(error) && error.cause !== undefined) {
    const causeMsg = Error.isError(error.cause)
      ? error.cause.message
      : String(error.cause);
    lines.push(`${LOG_GUTTER}${theme.muted(`caused by: ${causeMsg}`)}`);
  }

  if (verbose && Error.isError(error) && error.stack) {
    lines.push("");
    lines.push(theme.muted(error.stack));
  }

  return lines.join("\n");
}
