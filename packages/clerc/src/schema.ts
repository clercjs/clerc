import { ValidationError } from "./errors";
import type { SingleType, TypeFunction, TypeValue } from "./types";

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

const createSchemaConverter =
  (schema: StandardSchemaV1<any, any>): TypeConverter =>
  async (raw, target) => {
    const result = await schema["~standard"].validate(raw);
    if (result.issues) {
      throw new ValidationError(target, raw, result.issues);
    }

    return result.value;
  };

const createFunctionConverter =
  (fn: TypeFunction<any>): TypeConverter =>
  (raw, target) => {
    try {
      return fn(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      throw new ValidationError(target, raw, [{ message }], error);
    }
  };

const stringJsonSchema = (): Record<string, unknown> => ({ type: "string" });

const BUILTIN_DESCRIPTORS = new Map<unknown, TypeDescriptor>([
  [
    Boolean,
    {
      kind: "boolean",
      display: "boolean",
      toJsonSchema: () => ({ type: "boolean" }),
    },
  ],
  [
    Number,
    {
      kind: "single",
      display: "number",
      convert: convertNumber,
      toJsonSchema: () => ({ type: "number" }),
    },
  ],
  [
    String,
    {
      kind: "single",
      display: "string",
      toJsonSchema: stringJsonSchema,
    },
  ],
]);

const COUNTER_DESCRIPTOR: TypeDescriptor = {
  kind: "counter",
  display: "boolean",
  toJsonSchema: () => ({ type: "integer", minimum: 0 }),
};

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
  const builtin = BUILTIN_DESCRIPTORS.get(type);
  if (builtin) {
    return builtin;
  }

  const display = getDisplayLabel(type);
  if (isStandardSchema(type)) {
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
export function describeType(type: TypeValue): TypeDescriptor {
  if (!Array.isArray(type)) {
    return describeSingle(type as SingleType);
  }

  const inner = type[0] as SingleType;
  if (inner === Boolean) {
    return COUNTER_DESCRIPTOR;
  }

  const innerDesc = describeSingle(inner);

  return {
    kind: "array",
    display: `${innerDesc.display}...`,
    convert: innerDesc.convert,
    toJsonSchema: () => ({ type: "array", items: innerDesc.toJsonSchema() }),
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

export const Enum = <const T extends string>(
  ...values: readonly T[]
): ClercSchema<T> =>
  createSchema<T>(
    values.join("|"),
    { type: "string", enum: [...values] },
    (raw) =>
      values.includes(raw as T)
        ? { value: raw as T }
        : fail(`expected one of: ${values.map((v) => `'${v}'`).join(", ")}`),
  );

export const Range = (min: number, max: number): ClercSchema<number> =>
  createSchema<number>(
    `${min}..${max}`,
    { type: "number", minimum: min, maximum: max },
    (raw) => {
      const num = parseNumber(raw);

      return Number.isNaN(num) || num < min || num > max
        ? fail(`expected a number between ${min} and ${max}`)
        : { value: num };
    },
  );

export const Regex = (pattern: RegExp, display?: string): ClercSchema<string> =>
  createSchema<string>(
    display ?? pattern.toString(),
    { type: "string", pattern: pattern.source },
    (raw) =>
      pattern.test(raw)
        ? { value: raw }
        : fail(`expected value matching ${pattern}`),
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
  Enum,
  Range,
  Regex,
  Integer,
} as const;
