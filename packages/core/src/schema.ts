import type { TypeFunction } from "@clerc/parser";

import type { ValidationIssue } from "./errors";
import { ValidationError } from "./errors";
import type { CoreSingleType } from "./types";

export interface StandardSchemaV1PathSegment {
  readonly key: PropertyKey;
}

export interface StandardSchemaV1Issue {
  readonly message: string;
  readonly path?:
    readonly (PropertyKey | StandardSchemaV1PathSegment)[] | undefined;
}

export interface StandardSchemaV1SuccessResult<Output> {
  readonly value: Output;
  readonly issues?: undefined;
}

export interface StandardSchemaV1FailureResult {
  readonly issues: readonly StandardSchemaV1Issue[];
}

export type StandardSchemaV1Result<Output> =
  StandardSchemaV1SuccessResult<Output> | StandardSchemaV1FailureResult;

export interface StandardSchemaV1Types<Input = unknown, Output = Input> {
  readonly input: Input;
  readonly output: Output;
}

export interface StandardSchemaV1Props<Input = unknown, Output = Input> {
  readonly version: 1;
  readonly vendor: string;
  readonly validate: (
    value: unknown,
  ) => StandardSchemaV1Result<Output> | Promise<StandardSchemaV1Result<Output>>;
  readonly types?: StandardSchemaV1Types<Input, Output> | undefined;
}

/**
 * Standard Schema v1 specification interface (compatible with Zod, Valibot,
 * ArkType, etc.).
 *
 * @see https://standardschema.dev
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1Props<Input, Output>;
}

export const isStandardSchema = (
  value: unknown,
): value is StandardSchemaV1<any, any> =>
  typeof value === "object" &&
  value !== null &&
  "~standard" in value &&
  typeof (value as any)["~standard"] === "object" &&
  (value as any)["~standard"] !== null &&
  (value as any)["~standard"].version === 1 &&
  typeof (value as any)["~standard"].validate === "function";

export async function validateStandardSchema<T>(
  schema: StandardSchemaV1<unknown, T>,
  value: unknown,
): Promise<
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }
> {
  const result = await schema["~standard"].validate(value);
  if (result.issues) {
    return {
      ok: false,
      issues: result.issues.map((issue) => ({
        message: issue.message,
        path: issue.path,
      })),
    };
  }

  return { ok: true, value: result.value };
}

/**
 * Single source of truth for converting and validating a raw CLI string value
 * against a TypeFunction, Number constructor, or Standard Schema v1 validator.
 */
export async function convertValue(
  type: CoreSingleType,
  raw: string,
  target: string,
): Promise<unknown> {
  if (isStandardSchema(type)) {
    const result = await validateStandardSchema(type, raw);
    if (!result.ok) {
      throw new ValidationError(target, raw, result.issues);
    }

    return result.value;
  }

  if (type === Number) {
    const num = raw.trim() === "" ? Number.NaN : Number(raw);
    if (Number.isNaN(num)) {
      throw new ValidationError(target, raw, [
        { message: "expected a valid number" },
      ]);
    }

    return num;
  }

  try {
    return type(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new ValidationError(target, raw, [{ message }], error);
  }
}

export class FlagValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlagValidationError";
  }
}

export function Enum<T extends string>(
  ...values: readonly T[]
): TypeFunction<T> {
  const fn = ((value: string) => {
    if (!values.includes(value as T)) {
      throw new FlagValidationError(
        `expected one of: ${values.map((v) => `'${v}'`).join(", ")}`,
      );
    }

    return value as T;
  }) as TypeFunction<T>;
  fn.display = values.join("|");

  return fn;
}

export function Range(min: number, max: number): TypeFunction<number> {
  const fn = ((value: string) => {
    const num = Number(value);
    if (Number.isNaN(num) || num < min || num > max) {
      throw new FlagValidationError(
        `expected a number between ${min} and ${max}`,
      );
    }

    return num;
  }) as TypeFunction<number>;
  fn.display = `${min}..${max}`;

  return fn;
}

export function Regex(pattern: RegExp, display?: string): TypeFunction<string> {
  const fn = ((value: string) => {
    if (!pattern.test(value)) {
      throw new FlagValidationError(`expected value matching ${pattern}`);
    }

    return value;
  }) as TypeFunction<string>;
  fn.display = display ?? pattern.toString();

  return fn;
}

export const Integer: TypeFunction<number> = Object.assign(
  (value: string): number => {
    const num = Number(value);
    if (!Number.isInteger(num)) {
      throw new FlagValidationError("expected an integer");
    }

    return num;
  },
  { display: "integer" },
);

export const Types = {
  Enum,
  Range,
  Regex,
  Integer,
} as const;
