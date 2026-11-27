import { ConstraintError } from "./errors";
import type { Terminal } from "./terminal";

export interface CheckContext<
  Args extends Record<string, any> = Record<string, any>,
  Flags extends Record<string, any> = Record<string, any>,
> {
  readonly args: Args;
  readonly flags: Flags;
  readonly provided: {
    readonly flags: ReadonlySet<string>;
    readonly args: ReadonlySet<string>;
  };
  readonly terminal: Terminal;
}

export interface CheckFailure {
  readonly message: string;
  readonly detail?: string;
  readonly hints?: readonly string[];
}

export type CheckResult = void | string | CheckFailure;

export type CheckFn<
  Args extends Record<string, any> = Record<string, any>,
  Flags extends Record<string, any> = Record<string, any>,
> = (ctx: CheckContext<Args, Flags>) => CheckResult | Promise<CheckResult>;

export interface CheckOptions<
  Args extends Record<string, any> = Record<string, any>,
  Flags extends Record<string, any> = Record<string, any>,
> {
  readonly description: string;
  readonly validate: CheckFn<Args, Flags>;
}

export type CheckItem<
  Args extends Record<string, any> = Record<string, any>,
  Flags extends Record<string, any> = Record<string, any>,
> = CheckFn<Args, Flags> | CheckOptions<Args, Flags>;

export type CheckInput<
  Args extends Record<string, any> = Record<string, any>,
  Flags extends Record<string, any> = Record<string, any>,
> = CheckItem<Args, Flags> | readonly CheckItem<Args, Flags>[];

export interface CompiledChecks {
  readonly validators: readonly CheckFn[];
  readonly notes: readonly string[];
}

export const EMPTY_CHECKS: CompiledChecks = {
  validators: [],
  notes: [],
};

export function compileChecks(
  inputs: readonly (CheckInput<any, any> | undefined)[],
): CompiledChecks {
  const validators: CheckFn[] = [];
  const notes: string[] = [];

  function addItem(item: CheckItem<any, any>): void {
    if (typeof item === "function") {
      validators.push(item);
    } else {
      validators.push(item.validate);
      notes.push(item.description);
    }
  }

  for (const input of inputs) {
    if (!input) {
      continue;
    }
    if (Array.isArray(input)) {
      for (const item of input) {
        addItem(item);
      }
    } else {
      addItem(input as CheckItem<any, any>);
    }
  }

  return validators.length === 0 && notes.length === 0
    ? EMPTY_CHECKS
    : { validators, notes };
}

export async function validateChecks(
  validators: readonly CheckFn[],
  ctx: CheckContext,
): Promise<void> {
  for (const validate of validators) {
    const result = await validate(ctx);
    if (typeof result === "string" && result.length > 0) {
      throw new ConstraintError(result);
    }
    if (typeof result === "object" && result?.message) {
      throw new ConstraintError(result.message, {
        detail: result.detail,
        hints: result.hints,
      });
    }
  }
}
