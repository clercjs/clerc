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

export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1Props<Input, Output>;
}

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

export const isStandardSchema = (
  value: unknown,
): value is StandardSchemaV1<any, any> =>
  typeof value === "object" && value !== null && "~standard" in value;

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

const stringJsonSchema = (): Record<string, unknown> => ({ type: "string" });

function readStandardJsonSchema(
  schema: StandardSchemaV1<any, any>,
): Record<string, unknown> {
  const input = schema["~standard"].jsonSchema?.input;
  if (!input) {
    return stringJsonSchema();
  }
  const { $schema: _, ...rest } = input({ target: "draft-2020-12" });

  return rest;
}

const createSchemaConverter =
  (schema: StandardSchemaV1<any, any>): TypeConverter =>
  async (raw, target) => {
    const result = await schema["~standard"].validate(raw);
    if (result.issues) {
      const error = new ValidationError(target, raw, result.issues);
      const { enum: values } = readStandardJsonSchema(schema);
      if (Array.isArray(values)) {
        const candidates = values.filter(
          (v): v is string => typeof v === "string",
        );
        const maxDist = Math.min(3, Math.max(1, Math.floor(raw.length / 2)));
        const match = findClosest(raw, candidates, maxDist);
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

function describeSingle(type: SingleType): TypeDescriptor {
  if (type === Boolean) {
    return {
      kind: "boolean",
      display: "boolean",
      toJsonSchema: () => ({ type: "boolean" }),
    };
  }
  if (type === Number) {
    return {
      kind: "single",
      display: "number",
      convert: convertNumber,
      toJsonSchema: () => ({ type: "number" }),
    };
  }
  if (type === String) {
    return {
      kind: "single",
      display: "string",
      toJsonSchema: stringJsonSchema,
    };
  }

  const display =
    "display" in type && typeof type.display === "string"
      ? type.display
      : typeof type === "function" && type.name
        ? type.name.toLowerCase()
        : "value";

  if (isStandardSchema(type)) {
    return "~kind" in type && type["~kind"] === "counter"
      ? {
          kind: "counter",
          display,
          toJsonSchema: () => readStandardJsonSchema(type),
        }
      : {
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

export function describeType(
  type: SingleType,
  multiple = false,
): TypeDescriptor {
  const single = describeSingle(type);
  if (!multiple) {
    return single;
  }
  if (single.kind === "boolean" || single.kind === "counter") {
    throw new InvalidSchemaError(
      'Cannot combine "multiple: true" with Boolean or Counter flags. Use "Types.Counter" to count occurrences.',
    );
  }

  return {
    kind: "array",
    display: `${single.display}...`,
    convert: single.convert,
    toJsonSchema: () => ({ type: "array", items: single.toJsonSchema() }),
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
    jsonSchema: { input: () => ({ ...jsonSchema }) },
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

function createNumericSchema(
  kind: "integer" | "number",
  options: NumericSchemaOptions = {},
): ClercSchema<number> {
  const { min, max, display } = options;
  if (min !== undefined && max !== undefined && min > max) {
    throw new InvalidSchemaError(
      `Types.${kind === "integer" ? "Integer" : "Number"} invalid bounds: min (${min}) must be <= max (${max}).`,
    );
  }

  const noun = kind === "integer" ? "an integer" : "a number";
  const label =
    display ??
    (min !== undefined && max !== undefined
      ? `${min}..${max}`
      : min === undefined
        ? max === undefined
          ? kind
          : `<=${max}`
        : `>=${min}`);

  return createSchema<number>(
    label,
    {
      type: kind,
      ...(min !== undefined && { minimum: min }),
      ...(max !== undefined && { maximum: max }),
    },
    (raw) => {
      const num = parseNumber(raw);
      if (kind === "integer" ? !Number.isInteger(num) : Number.isNaN(num)) {
        return fail(`expected ${noun}`);
      }
      if (min !== undefined && num < min) {
        return fail(
          max === undefined
            ? `expected ${noun} >= ${min}`
            : `expected ${noun} between ${min} and ${max}`,
        );
      }
      if (max !== undefined && num > max) {
        return fail(
          min === undefined
            ? `expected ${noun} <= ${max}`
            : `expected ${noun} between ${min} and ${max}`,
        );
      }

      return { value: num };
    },
  );
}

function StringType(options: StringSchemaOptions = {}): ClercSchema<string> {
  const {
    trim = false,
    nonEmpty = false,
    pattern,
    display,
    maxLength,
  } = options;
  const minLength =
    options.minLength === undefined
      ? nonEmpty
        ? 1
        : undefined
      : Math.max(options.minLength, nonEmpty ? 1 : 0);

  if (
    minLength !== undefined &&
    maxLength !== undefined &&
    minLength > maxLength
  ) {
    throw new InvalidSchemaError(
      `Types.String invalid length bounds: minLength (${minLength}) must be <= maxLength (${maxLength}).`,
    );
  }

  return createSchema<string>(
    display ?? "string",
    {
      type: "string",
      ...(minLength !== undefined && { minLength }),
      ...(maxLength !== undefined && { maxLength }),
      ...(pattern !== undefined && { pattern: pattern.source }),
    },
    (raw) => {
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
    },
  );
}

export interface ArrayConstraintOptions {
  readonly unique?: boolean;
  readonly minItems?: number;
  readonly maxItems?: number;
}

export function validateArraySchemaOptions(
  label: string,
  isArray: boolean,
  { unique, minItems, maxItems }: ArrayConstraintOptions,
): void {
  if (!unique && minItems === undefined && maxItems === undefined) {
    return;
  }
  if (!isArray) {
    throw new InvalidSchemaError(
      `${label} array constraints (unique, minItems, maxItems) can only be used with array flags or variadic arguments.`,
    );
  }
  if (
    (minItems !== undefined && minItems < 0) ||
    (maxItems !== undefined && maxItems < 0) ||
    (minItems !== undefined && maxItems !== undefined && minItems > maxItems)
  ) {
    throw new InvalidSchemaError(`${label} has invalid item count bounds.`);
  }
}

export const withArrayJsonSchema = (
  schema: Record<string, unknown>,
  { unique, minItems, maxItems }: ArrayConstraintOptions,
): Record<string, unknown> => ({
  ...schema,
  ...(unique ? { uniqueItems: true } : {}),
  ...(minItems === undefined ? {} : { minItems }),
  ...(maxItems === undefined ? {} : { maxItems }),
});

export function validateArrayConstraints(
  target: string,
  values: readonly unknown[],
  { unique, minItems, maxItems }: ArrayConstraintOptions,
): void {
  if (minItems !== undefined && values.length < minItems) {
    throw new ValidationError(target, values, [
      { message: `expected at least ${minItems} ${plural(minItems, "item")}` },
    ]);
  }
  if (maxItems !== undefined && values.length > maxItems) {
    throw new ValidationError(target, values, [
      { message: `expected at most ${maxItems} ${plural(maxItems, "item")}` },
    ]);
  }
  if (unique) {
    const seen = new Set<unknown>();
    for (const item of values) {
      if (seen.has(item)) {
        throw new ValidationError(target, values, [
          { message: `duplicate value '${String(item)}'` },
        ]);
      }
      seen.add(item);
    }
  }
}

export async function convertItemList(
  convert: TypeConverter | undefined,
  target: string,
  items: readonly string[],
  constraints?: ArrayConstraintOptions,
): Promise<unknown[]> {
  const converted = convert
    ? await Promise.all(items.map((item) => convert(item, target)))
    : [...items];
  if (constraints) {
    validateArrayConstraints(target, converted, constraints);
  }

  return converted;
}

export const Types = {
  Counter,
  Enum,
  Integer: (options?: NumericSchemaOptions) =>
    createNumericSchema("integer", options),
  Number: (options?: NumericSchemaOptions) =>
    createNumericSchema("number", options),
  String: StringType,
  Regex: (pattern: RegExp, display?: string) =>
    StringType({ pattern, display: display ?? pattern.toString() }),
} as const;
