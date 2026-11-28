import { ConstraintError } from "./errors";
import type { Terminal } from "./terminal";
import type { MaybeArray } from "./utils";

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

export type CheckInput<
  Args extends Record<string, any> = Record<string, any>,
  Flags extends Record<string, any> = Record<string, any>,
> = MaybeArray<CheckFn<Args, Flags>>;

export function collectChecks(
  inputs: readonly (CheckInput<any, any> | undefined)[],
): readonly CheckFn[] {
  const checks: CheckFn[] = [];
  for (const input of inputs) {
    if (!input) {
      continue;
    }
    if (Array.isArray(input)) {
      checks.push(...input);
    } else {
      checks.push(input as CheckFn);
    }
  }

  return checks;
}

export async function validateChecks(
  checks: readonly CheckFn[],
  ctx: CheckContext,
): Promise<void> {
  for (const validate of checks) {
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
