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

/**
 * Built-in Standard Schema v1 validator with a help display label.
 */
export interface ClercSchema<Output = unknown> extends StandardSchemaV1<
  string,
  Output
> {
  readonly display: string;
}

export function isStandardSchema(
  value: unknown,
): value is StandardSchemaV1<any, any> {
  if (typeof value !== "object" || value === null || !("~standard" in value)) {
    return false;
  }
  const std = value["~standard"];

  return (
    typeof std === "object" &&
    std !== null &&
    (std as StandardSchemaV1Props).version === 1 &&
    typeof (std as StandardSchemaV1Props).validate === "function"
  );
}

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

const parseNumber = (raw: string): number =>
  raw.trim() === "" ? Number.NaN : Number(raw);

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
    const num = parseNumber(raw);
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

const createSchema = <T>(
  display: string,
  validate: (raw: string) => StandardSchemaV1Result<T>,
): ClercSchema<T> => ({
  display,
  "~standard": {
    version: 1,
    vendor: "clerc",
    validate: (value) => validate(String(value)),
  },
});

export const Enum = <const T extends string>(
  ...values: readonly T[]
): ClercSchema<T> =>
  createSchema<T>(values.join("|"), (raw) => {
    if (!values.includes(raw as T)) {
      return {
        issues: [
          {
            message: `expected one of: ${values.map((v) => `'${v}'`).join(", ")}`,
          },
        ],
      };
    }

    return { value: raw as T };
  });

export const Range = (min: number, max: number): ClercSchema<number> =>
  createSchema<number>(`${min}..${max}`, (raw) => {
    const num = parseNumber(raw);
    if (Number.isNaN(num) || num < min || num > max) {
      return {
        issues: [{ message: `expected a number between ${min} and ${max}` }],
      };
    }

    return { value: num };
  });

export const Regex = (pattern: RegExp, display?: string): ClercSchema<string> =>
  createSchema<string>(display ?? pattern.toString(), (raw) => {
    if (!pattern.test(raw)) {
      return {
        issues: [{ message: `expected value matching ${pattern}` }],
      };
    }

    return { value: raw };
  });

export const Integer: ClercSchema<number> = createSchema<number>(
  "integer",
  (raw) => {
    const num = parseNumber(raw);
    if (!Number.isInteger(num)) {
      return {
        issues: [{ message: "expected an integer" }],
      };
    }

    return { value: num };
  },
);

export const Types = {
  Enum,
  Range,
  Regex,
  Integer,
} as const;
