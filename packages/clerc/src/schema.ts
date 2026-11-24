import { InvalidSchemaError, ValidationError } from "./errors";
import { findClosest } from "./suggest";
import type { IsAny } from "./utils";
import { plural } from "./utils";

export interface DefaultValueFunction<T> {
  (): T;
  display?: string;
}

export type DefaultValue<T = unknown> = T | DefaultValueFunction<T>;

export interface TypeFunction<T = unknown> {
  (value: string): T;
  display?: string;
}

export type SingleType<T = any> = TypeFunction<T> | StandardSchemaV1<any, T>;

export type StrictOptions<T, Allowed> = T extends object
  ? Allowed & Readonly<Partial<Record<Exclude<keyof T, keyof Allowed>, never>>>
  : Allowed;

export type UnwrapDefault<D> = D extends () => infer R ? R : D;

type InferStandardSchemaOutput<T extends StandardSchemaV1<any, any>> =
  T["~standard"] extends {
    readonly types?: { readonly output: infer Output } | undefined;
  }
    ? IsAny<Output> extends true
      ? any
      : unknown extends Output
        ? T extends StandardSchemaV1<any, infer U>
          ? U
          : Output
        : Output
    : T extends StandardSchemaV1<any, infer U>
      ? U
      : never;

export type InferSingleType<T> =
  T extends StandardSchemaV1<any, any>
    ? InferStandardSchemaOutput<T>
    : T extends TypeFunction<infer U>
      ? U
      : never;

export interface StandardSchemaV1Issue {
  readonly message: string;
  readonly path?:
    readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined;
}

export type StandardSchemaV1Result<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: readonly StandardSchemaV1Issue[] };

export interface StandardSchemaV1Props<Input = unknown, Output = Input> {
  readonly version: 1;
  readonly vendor: string;
  readonly validate: (
    value: unknown,
  ) => StandardSchemaV1Result<Output> | Promise<StandardSchemaV1Result<Output>>;
  readonly types?:
    { readonly input: Input; readonly output: Output } | undefined;
  readonly jsonSchema?:
    | {
        readonly input: (options: {
          readonly target: string;
        }) => Record<string, unknown>;
        readonly output?: (options: {
          readonly target: string;
        }) => Record<string, unknown>;
      }
    | undefined;
}

/**
 * Standard Schema v1 & Standard JSON Schema v1 interface (Zod, Valibot,
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

export interface CounterSchema extends ClercSchema<number> {
  readonly "~kind": "counter";
}

export type FlagKind = "boolean" | "counter" | "array" | "single";

export type TypeConverter = (
  raw: string,
  target: string,
) => unknown | Promise<unknown>;

interface TypeDescriptor {
  readonly kind: FlagKind;
  readonly display: string;
  readonly convert?: TypeConverter;
  readonly toJsonSchema: () => Record<string, unknown>;
}

export function isStandardSchema(
  value: unknown,
): value is StandardSchemaV1<any, any> {
  if (typeof value !== "object" || value === null || !("~standard" in value)) {
    return false;
  }
  const std = value["~standard"] as Partial<StandardSchemaV1Props> | null;

  return (
    typeof std === "object" &&
    std !== null &&
    std.version === 1 &&
    typeof std.validate === "function"
  );
}

const parseNumber = (raw: string): number =>
  raw.trim() === "" ? Number.NaN : Number(raw);

const convertNumber: TypeConverter = (raw, target) => {
  const num = parseNumber(raw);
  if (Number.isNaN(num)) {
    throw new ValidationError(target, raw, [
      { message: "expected a valid number" },
    ]);
  }

  return num;
};

const ENUM_DISTANCE_THRESHOLD = 3;

const createSchemaConverter =
  (schema: StandardSchemaV1<any, any>): TypeConverter =>
  async (raw, target) => {
    const result = await schema["~standard"].validate(raw);
    if (result.issues) {
      const error = new ValidationError(target, raw, result.issues);
      const jsonSchema = readStandardJsonSchema(schema);
      if (Array.isArray(jsonSchema.enum)) {
        const candidates = jsonSchema.enum.filter(
          (val): val is string => typeof val === "string",
        );
        const maxDistance = Math.min(
          ENUM_DISTANCE_THRESHOLD,
          Math.max(1, Math.floor(raw.length / 2)),
        );
        const match = findClosest(raw, candidates, maxDistance);
        if (match) {
          error.addHint(`a similar value exists: '${match}'`);
        }
      }

      throw error;
    }

    return result.value;
  };

const createFunctionConverter =
  (fn: TypeFunction<any>): TypeConverter =>
  (raw, target) => {
    try {
      return fn(raw);
    } catch (error) {
      const message = Error.isError(error) ? error.message : String(error);

      throw new ValidationError(target, raw, [{ message }], error);
    }
  };

const stringJsonSchema = (): Record<string, unknown> => ({ type: "string" });

function readStandardJsonSchema(
  schema: StandardSchemaV1<any, any>,
): Record<string, unknown> {
  const input = schema["~standard"].jsonSchema?.input;
  if (!input) {
    return stringJsonSchema();
  }
  try {
    const { $schema: _, ...rest } = input({ target: "draft-2020-12" });

    return rest;
  } catch {
    return stringJsonSchema();
  }
}

function getDisplayLabel(type: SingleType): string {
  if ("display" in type && typeof type.display === "string") {
    return type.display;
  }

  return typeof type === "function" && type.name
    ? type.name.toLowerCase()
    : "value";
}

function describeSingle(type: SingleType): TypeDescriptor {
  switch (type) {
    case Boolean: {
      return {
        kind: "boolean",
        display: "boolean",
        toJsonSchema: () => ({ type: "boolean" }),
      };
    }
    case Number: {
      return {
        kind: "single",
        display: "number",
        convert: convertNumber,
        toJsonSchema: () => ({ type: "number" }),
      };
    }
    case String: {
      return {
        kind: "single",
        display: "string",
        toJsonSchema: stringJsonSchema,
      };
    }
  }

  const display = getDisplayLabel(type);
  if (isStandardSchema(type)) {
    if ("~kind" in type && type["~kind"] === "counter") {
      return {
        kind: "counter",
        display,
        toJsonSchema: () => readStandardJsonSchema(type),
      };
    }

    return {
      kind: "single",
      display,
      convert: createSchemaConverter(type),
      toJsonSchema: () => readStandardJsonSchema(type),
    };
  }

  return {
    kind: "single",
    display,
    convert: createFunctionConverter(type),
    toJsonSchema: stringJsonSchema,
  };
}

/**
 * Single source of truth for classifying any flag or argument type across flag
 * compilation, help rendering, completions, and MCP JSON Schema export.
 */
export function describeType(
  type: SingleType,
  multiple = false,
): TypeDescriptor {
  if (Array.isArray(type)) {
    throw new InvalidSchemaError(
      'Array tuple flag types ([Type]) are no longer supported. Use "{ type, multiple: true }" or "Types.Counter" instead.',
    );
  }

  const singleDesc = describeSingle(type);
  if (!multiple) {
    return singleDesc;
  }

  if (singleDesc.kind === "boolean" || singleDesc.kind === "counter") {
    throw new InvalidSchemaError(
      'Cannot combine "multiple: true" with Boolean or Counter flags. Use "Types.Counter" to count occurrences.',
    );
  }

  return {
    kind: "array",
    display: `${singleDesc.display}...`,
    convert: singleDesc.convert,
    toJsonSchema: () => ({ type: "array", items: singleDesc.toJsonSchema() }),
  };
}

const fail = (
  message: string,
): { readonly issues: readonly [StandardSchemaV1Issue] } => ({
  issues: [{ message }],
});

const createSchema = <T>(
  display: string,
  jsonSchema: Readonly<Record<string, unknown>>,
  validate: (raw: string) => StandardSchemaV1Result<T>,
): ClercSchema<T> => ({
  display,
  "~standard": {
    version: 1,
    vendor: "clerc",
    validate: (value) => validate(String(value)),
    jsonSchema: {
      input: () => ({ ...jsonSchema }),
      output: () => ({ ...jsonSchema }),
    },
  },
});

const Counter: CounterSchema = {
  ...createSchema<number>("count", { type: "integer", minimum: 0 }, (raw) => {
    const num = parseNumber(raw);

    return Number.isInteger(num) && num >= 0
      ? { value: num }
      : fail("expected a non-negative integer");
  }),
  "~kind": "counter",
};

function Enum<const T extends string>(...values: readonly T[]): ClercSchema<T> {
  if (values.length === 0) {
    throw new InvalidSchemaError("Types.Enum requires at least one value.");
  }

  return createSchema<T>(
    values.join("|"),
    { type: "string", enum: [...values] },
    (raw) =>
      values.includes(raw as T)
        ? { value: raw as T }
        : fail(`expected one of: ${values.map((v) => `'${v}'`).join(", ")}`),
  );
}

export interface NumericSchemaOptions {
  readonly min?: number;
  readonly max?: number;
  readonly display?: string;
}

export interface StringSchemaOptions {
  readonly trim?: boolean;
  readonly nonEmpty?: boolean;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: RegExp;
  readonly display?: string;
}

function formatNumericDisplay(
  fallback: string,
  min?: number,
  max?: number,
  display?: string,
): string {
  if (display !== undefined) {
    return display;
  }
  if (min !== undefined && max !== undefined) {
    return `${min}..${max}`;
  }
  if (min !== undefined) {
    return `>=${min}`;
  }
  if (max !== undefined) {
    return `<=${max}`;
  }

  return fallback;
}

function createNumericSchema(
  kind: "integer" | "number",
  options: NumericSchemaOptions = {},
): ClercSchema<number> {
  const { min, max, display } = options;
  if (
    (min !== undefined && Number.isNaN(min)) ||
    (max !== undefined && Number.isNaN(max)) ||
    (min !== undefined && max !== undefined && min > max)
  ) {
    throw new InvalidSchemaError(
      `Types.${kind === "integer" ? "Integer" : "Number"} invalid bounds: min (${min}) must be <= max (${max}).`,
    );
  }

  const noun = kind === "integer" ? "an integer" : "a number";
  const jsonSchema: Record<string, unknown> = { type: kind };
  if (min !== undefined) {
    jsonSchema.minimum = min;
  }
  if (max !== undefined) {
    jsonSchema.maximum = max;
  }

  return createSchema<number>(
    formatNumericDisplay(kind, min, max, display),
    jsonSchema,
    (raw) => {
      const num = parseNumber(raw);
      if (kind === "integer" ? !Number.isInteger(num) : Number.isNaN(num)) {
        return fail(`expected ${noun}`);
      }
      if (
        (min !== undefined && num < min) ||
        (max !== undefined && num > max)
      ) {
        if (min !== undefined && max !== undefined) {
          return fail(`expected ${noun} between ${min} and ${max}`);
        }
        if (min !== undefined) {
          return fail(`expected ${noun} >= ${min}`);
        }

        return fail(`expected ${noun} <= ${max}`);
      }

      return { value: num };
    },
  );
}

const Integer = (options?: NumericSchemaOptions): ClercSchema<number> =>
  createNumericSchema("integer", options);

const NumberType = (options?: NumericSchemaOptions): ClercSchema<number> =>
  createNumericSchema("number", options);

function StringType(options: StringSchemaOptions = {}): ClercSchema<string> {
  const { trim = false, nonEmpty = false, pattern, display } = options;
  const minLength =
    options.minLength === undefined
      ? nonEmpty
        ? 1
        : undefined
      : Math.max(options.minLength, nonEmpty ? 1 : 0);
  const { maxLength } = options;

  if (
    (minLength !== undefined &&
      (!Number.isInteger(minLength) || minLength < 0)) ||
    (maxLength !== undefined &&
      (!Number.isInteger(maxLength) || maxLength < 0)) ||
    (minLength !== undefined &&
      maxLength !== undefined &&
      minLength > maxLength)
  ) {
    throw new InvalidSchemaError(
      `Types.String invalid length bounds: minLength (${minLength}) must be <= maxLength (${maxLength}).`,
    );
  }

  const jsonSchema: Record<string, unknown> = { type: "string" };
  if (minLength !== undefined) {
    jsonSchema.minLength = minLength;
  }
  if (maxLength !== undefined) {
    jsonSchema.maxLength = maxLength;
  }
  if (pattern !== undefined) {
    jsonSchema.pattern = pattern.source;
  }

  return createSchema<string>(display ?? "string", jsonSchema, (raw) => {
    const value = trim ? raw.trim() : raw;
    if (nonEmpty && value.length === 0) {
      return fail("expected a non-empty string");
    }
    if (minLength !== undefined && value.length < minLength) {
      return fail(
        `expected a string with at least ${minLength} ${plural(minLength, "character")}`,
      );
    }
    if (maxLength !== undefined && value.length > maxLength) {
      return fail(
        `expected a string with at most ${maxLength} ${plural(maxLength, "character")}`,
      );
    }
    if (pattern !== undefined) {
      pattern.lastIndex = 0;
      if (!pattern.test(value)) {
        return fail(`expected value matching ${pattern}`);
      }
    }

    return { value };
  });
}

const Regex = (pattern: RegExp, display?: string): ClercSchema<string> =>
  StringType({ pattern, display: display ?? pattern.toString() });

export const Types = {
  Counter,
  Enum,
  Integer,
  Number: NumberType,
  String: StringType,
  Regex,
} as const;
