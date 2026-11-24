import { InvalidSchemaError, ValidationError } from "./errors";
import { findClosest } from "./suggest";
import type { IsAny } from "./utils";

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

export interface TypeDescriptor {
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

export const Counter: CounterSchema = {
  ...createSchema<number>("count", { type: "integer", minimum: 0 }, (raw) => {
    const num = parseNumber(raw);

    return Number.isInteger(num) && num >= 0
      ? { value: num }
      : fail("expected a non-negative integer");
  }),
  "~kind": "counter",
};

export function Enum<const T extends string>(
  ...values: readonly T[]
): ClercSchema<T> {
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

export function Range(min: number, max: number): ClercSchema<number> {
  if (Number.isNaN(min) || Number.isNaN(max) || min > max) {
    throw new InvalidSchemaError(
      `Types.Range invalid bounds: min (${min}) must be <= max (${max}).`,
    );
  }

  return createSchema<number>(
    `${min}..${max}`,
    { type: "number", minimum: min, maximum: max },
    (raw) => {
      const num = parseNumber(raw);

      return Number.isNaN(num) || num < min || num > max
        ? fail(`expected a number between ${min} and ${max}`)
        : { value: num };
    },
  );
}

export const Regex = (pattern: RegExp, display?: string): ClercSchema<string> =>
  createSchema<string>(
    display ?? pattern.toString(),
    { type: "string", pattern: pattern.source },
    (raw) => {
      pattern.lastIndex = 0;

      return pattern.test(raw)
        ? { value: raw }
        : fail(`expected value matching ${pattern}`);
    },
  );

export const Integer: ClercSchema<number> = createSchema<number>(
  "integer",
  { type: "integer" },
  (raw) => {
    const num = parseNumber(raw);

    return Number.isInteger(num) ? { value: num } : fail("expected an integer");
  },
);

export const Types = {
  Counter,
  Enum,
  Range,
  Regex,
  Integer,
} as const;
