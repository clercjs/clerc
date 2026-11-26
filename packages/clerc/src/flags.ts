import {
  InvalidSchemaError,
  MissingFlagValueError,
  MissingRequiredFlagError,
  UnknownFlagError,
  ValidationError,
} from "./errors";
import type { ArgvFlagSpec, InvalidFlagValue } from "./parser";
import {
  IMPLICIT_FLAG_VALUE,
  INVALID_BOOL_MSG,
  parseBooleanLiteral,
} from "./parser";
import type {
  CounterSchema,
  DefaultValue,
  FlagKind,
  InferSingleType,
  SingleType,
  StrictOptions,
  TypeConverter,
  UnwrapDefault,
} from "./schema";
import { describeType, isStandardSchema } from "./schema";
import { findClosest } from "./suggest";
import type { CompletionOption } from "./types";
import type { IsAny, MaybeArray, Prettify } from "./utils";
import {
  evaluateDefault,
  formatFlagName,
  kebabCase,
  plural,
  toArray,
} from "./utils";

export interface FlagCustomMeta {}
export type FlagMeta = FlagCustomMeta & Record<string, unknown>;

export interface ArrayConstraintOptions {
  readonly unique?: boolean;
  readonly minItems?: number;
  readonly maxItems?: number;
}

interface FlagSharedMeta extends ArrayConstraintOptions {
  readonly short?: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly delimiter?: string;
  readonly env?: string;
  readonly group?: string;
  readonly deprecated?: boolean | string;
  readonly complete?: CompletionOption;
  readonly meta?: FlagMeta;
}

export interface FlagOptions<
  T extends SingleType = SingleType,
> extends FlagSharedMeta {
  readonly type: T;
  readonly multiple?: boolean;
  readonly aliases?: MaybeArray<string>;
  readonly default?: DefaultValue;
  readonly implicitValue?: DefaultValue;
  readonly required?: boolean;
  readonly negatable?: boolean;
  readonly hidden?: boolean;
}

export type FlagDefinitionValue = FlagOptions | SingleType;
export type FlagsDefinition = Record<string, FlagDefinitionValue>;

type ContextualFlagValue<V> = [V] extends [never]
  ? FlagOptions
  : V extends SingleType
    ? V
    : StrictOptions<V, FlagOptions>;

export type ContextualFlags<Flags extends Record<string, any>> = {
  readonly [K in keyof Flags]: ContextualFlagValue<Flags[K]>;
};

export interface FlagDescriptor extends FlagSharedMeta {
  readonly name: string;
  readonly target: string;
  readonly aliases: readonly string[];
  readonly kind: FlagKind;
  readonly display: string;
  readonly default?: unknown;
  readonly implicitValue?: unknown;
  readonly unique: boolean;
  readonly required: boolean;
  readonly negatable: boolean;
  readonly hidden: boolean;
  readonly toJsonSchema: () => Record<string, unknown>;
}

type InferFlagDefault<T extends FlagDefinitionValue, Fallback> = T extends {
  readonly default: infer D;
}
  ? [D] extends [undefined]
    ? Fallback
    : UnwrapDefault<D>
  : Fallback;

type InferFlagImplicitValue<T extends FlagDefinitionValue> = T extends {
  readonly implicitValue: infer D;
}
  ? [D] extends [undefined]
    ? never
    : UnwrapDefault<D>
  : never;

type IsTypeAny<T extends FlagDefinitionValue> =
  IsAny<T> extends true
    ? true
    : T extends { readonly type: infer Type }
      ? IsAny<Type> extends true
        ? true
        : false
      : false;

type InferSingleFlag<T extends FlagDefinitionValue> =
  IsTypeAny<T> extends true
    ? any
    : T extends CounterSchema | { readonly type: CounterSchema }
      ? number
      : T extends { readonly type: infer Item; readonly multiple: true }
        ? InferSingleType<Item>[]
        : T extends { readonly type: infer Item }
          ? | InferSingleType<Item>
            | InferFlagImplicitValue<T>
            | InferFlagDefault<
                T,
                [InferSingleType<Item>] extends [boolean]
                  ? never
                  : T extends { readonly required: true }
                    ? never
                    : undefined
              >
          : T extends SingleType
            ? | InferSingleType<T>
              | ([InferSingleType<T>] extends [boolean] ? never : undefined)
            : never;

export type InferFlags<T extends Record<string, any>> = Prettify<{
  [K in keyof T]: T[K] extends FlagDefinitionValue
    ? InferSingleFlag<T[K]>
    : never;
}>;

type KnownKeys<T> = string extends keyof T ? never : keyof T;

export type OverrideFlags<
  Base extends Record<string, any>,
  Next extends Record<string, any>,
> = Omit<Base, KnownKeys<Next>> & Next;

export type MergedFlags<
  LocalFlags extends Record<string, any>,
  GlobalFlags extends Record<string, any>,
> = InferFlags<OverrideFlags<GlobalFlags, LocalFlags>>;

export interface CompiledFlagEntry extends FlagDescriptor {
  readonly convert?: TypeConverter;
}

export interface CompiledFlags {
  readonly entries: readonly CompiledFlagEntry[];
  readonly byName: ReadonlyMap<string, CompiledFlagEntry>;
  readonly specs: readonly ArgvFlagSpec[];
  readonly knownNames: readonly string[];
}

function normalizeFlagValue(flag: FlagDefinitionValue): FlagOptions {
  if (typeof flag === "function" || isStandardSchema(flag)) {
    return { type: flag as SingleType };
  }
  if (Array.isArray(flag)) {
    throw new InvalidSchemaError(
      'Array tuple flag types ([Type]) are no longer supported. Use "{ type, multiple: true }" or "Types.Counter" instead.',
    );
  }

  return flag as FlagOptions;
}

function implicitDefault(kind: FlagKind): unknown {
  switch (kind) {
    case "boolean": {
      return false;
    }
    case "counter": {
      return 0;
    }
    case "array": {
      return [];
    }
    case "single": {
      return undefined;
    }
  }
}

export const createBuiltinFlagDescriptor = (
  name: string,
  short: string | undefined,
  description: string,
  kind: "boolean" | "counter" = "boolean",
): FlagDescriptor => ({
  name,
  target: formatFlagName(name),
  short,
  aliases: [],
  kind,
  display: "boolean",
  description,
  unique: false,
  required: false,
  negatable: false,
  hidden: false,

  toJsonSchema: () =>
    kind === "counter" ? { type: "integer", minimum: 0 } : { type: "boolean" },
});

export function compileFlagEntries(
  flags: FlagsDefinition,
): CompiledFlagEntry[] {
  const entries: CompiledFlagEntry[] = [];

  for (const name of Object.keys(flags)) {
    const norm = normalizeFlagValue(flags[name]);
    if (norm.required && norm.default !== undefined) {
      throw new InvalidSchemaError(
        `Flag "${name}" cannot be both required and have a default value.`,
      );
    }

    const { kind, display, convert, toJsonSchema } = describeType(
      norm.type,
      Boolean(norm.multiple),
    );
    if (norm.delimiter !== undefined) {
      if (kind !== "array") {
        throw new InvalidSchemaError(
          `Flag "${name}" delimiter can only be used with array flag types.`,
        );
      }
      if (norm.delimiter.length === 0) {
        throw new InvalidSchemaError(
          `Flag "${name}" delimiter must be a non-empty string.`,
        );
      }
    }
    if (norm.implicitValue !== undefined && kind !== "single") {
      throw new InvalidSchemaError(
        `Flag "${name}" implicitValue can only be used with single-value flag types.`,
      );
    }
    validateArraySchemaOptions(`Flag "${name}"`, kind === "array", norm);

    const aliases = norm.aliases ? toArray(norm.aliases).map(kebabCase) : [];
    const negatable = kind === "boolean" && norm.negatable !== false;
    const entry: CompiledFlagEntry = {
      name,
      target: formatFlagName(name),
      short: norm.short,
      aliases,
      kind,
      display,
      description: norm.description,
      placeholder: norm.placeholder,
      default: norm.default,
      implicitValue: norm.implicitValue,
      delimiter: norm.delimiter,
      unique: Boolean(norm.unique),
      minItems: norm.minItems,
      maxItems: norm.maxItems,
      required: Boolean(norm.required),
      env: norm.env,
      negatable,
      group: norm.group,
      hidden: Boolean(norm.hidden),
      deprecated: norm.deprecated,

      complete: norm.complete,
      meta: norm.meta,
      toJsonSchema:
        kind === "array" &&
        (norm.unique ||
          norm.minItems !== undefined ||
          norm.maxItems !== undefined)
          ? () => withArrayJsonSchema(toJsonSchema(), norm)
          : toJsonSchema,
      convert,
    };

    entries.push(entry);
  }

  return entries;
}

export function buildCompiledFlags(
  entries: readonly CompiledFlagEntry[],
): CompiledFlags {
  const byName = new Map<string, CompiledFlagEntry>();
  const specs: ArgvFlagSpec[] = [];
  const knownNames: string[] = [];

  for (const entry of entries) {
    byName.set(entry.name, entry);
    specs.push({
      key: entry.name,
      kind: entry.kind,
      short: entry.short,
      aliases: entry.aliases.length > 0 ? entry.aliases : undefined,
      negatable: entry.kind === "boolean" ? entry.negatable : undefined,
      optionalValue: entry.implicitValue !== undefined,
    });
    knownNames.push(kebabCase(entry.name), ...entry.aliases);
  }

  return { entries, byName, specs, knownNames };
}

export function validateArraySchemaOptions(
  label: string,
  isArray: boolean,
  options: ArrayConstraintOptions,
): void {
  const hasArrayConstraint =
    Boolean(options.unique) ||
    options.minItems !== undefined ||
    options.maxItems !== undefined;
  if (!hasArrayConstraint) {
    return;
  }
  if (!isArray) {
    throw new InvalidSchemaError(
      `${label} array constraints (unique, minItems, maxItems) can only be used with array flags or variadic arguments.`,
    );
  }
  for (const [key, val] of [
    ["minItems", options.minItems],
    ["maxItems", options.maxItems],
  ] as const) {
    if (val !== undefined && (!Number.isInteger(val) || val < 0)) {
      throw new InvalidSchemaError(
        `${label} ${key} must be a non-negative integer.`,
      );
    }
  }
  if (
    options.minItems !== undefined &&
    options.maxItems !== undefined &&
    options.minItems > options.maxItems
  ) {
    throw new InvalidSchemaError(
      `${label} minItems (${options.minItems}) must be <= maxItems (${options.maxItems}).`,
    );
  }
}

export function withArrayJsonSchema(
  schema: Record<string, unknown>,
  options: ArrayConstraintOptions,
): Record<string, unknown> {
  const out = { ...schema };
  if (options.unique) {
    out.uniqueItems = true;
  }
  if (options.minItems !== undefined) {
    out.minItems = options.minItems;
  }
  if (options.maxItems !== undefined) {
    out.maxItems = options.maxItems;
  }

  return out;
}

export function validateArrayConstraints(
  target: string,
  values: readonly unknown[],
  options: ArrayConstraintOptions,
): void {
  if (options.minItems !== undefined && values.length < options.minItems) {
    throw new ValidationError(target, values, [
      {
        message: `expected at least ${options.minItems} ${plural(options.minItems, "item")}`,
      },
    ]);
  }
  if (options.maxItems !== undefined && values.length > options.maxItems) {
    throw new ValidationError(target, values, [
      {
        message: `expected at most ${options.maxItems} ${plural(options.maxItems, "item")}`,
      },
    ]);
  }
  if (options.unique) {
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
  let converted: unknown[];
  if (convert) {
    converted = [];
    for (const item of items) {
      converted.push(await convert(item, target));
    }
  } else {
    converted = [...items];
  }
  if (constraints) {
    validateArrayConstraints(target, converted, constraints);
  }

  return converted;
}

async function resolveEnvValue(
  entry: CompiledFlagEntry,
  envValue: string,
): Promise<unknown> {
  switch (entry.kind) {
    case "boolean": {
      const parsed = parseBooleanLiteral(envValue);
      if (parsed === undefined) {
        throw new ValidationError(entry.target, envValue, [
          { message: INVALID_BOOL_MSG },
        ]);
      }

      return parsed;
    }
    case "counter": {
      const trimmed = envValue.trim();
      const count = trimmed === "" ? Number.NaN : Number(trimmed);
      if (Number.isInteger(count) && count >= 0) {
        return count;
      }
      const parsedBool = parseBooleanLiteral(trimmed);
      if (parsedBool !== undefined) {
        return parsedBool ? 1 : 0;
      }

      throw new ValidationError(entry.target, envValue, [
        { message: "expected a non-negative integer or boolean" },
      ]);
    }
    case "array": {
      const delimiter = entry.delimiter ?? ",";

      return convertItemList(
        entry.convert,
        entry.target,
        envValue.split(delimiter).map((s) => s.trim()),
        entry,
      );
    }
    case "single": {
      return entry.convert ? entry.convert(envValue, entry.target) : envValue;
    }
  }
}

export async function resolveCompiledFlags(
  compiled: CompiledFlags,
  rawFlags: Record<string, any>,
  explicitlyProvided: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): Promise<{
  readonly flags: Record<string, any>;
  readonly missingRequired: string[];
  readonly provided: Set<string>;
}> {
  const flags: Record<string, any> = {};
  const missingRequired: string[] = [];
  const provided = new Set<string>(explicitlyProvided);

  for (const entry of compiled.entries) {
    const { name, kind, target, convert } = entry;
    const rawValue = rawFlags[name];

    if (provided.has(name)) {
      if (rawValue === IMPLICIT_FLAG_VALUE) {
        flags[name] = evaluateDefault(entry.implicitValue);
      } else if (kind === "array") {
        const items = entry.delimiter
          ? (rawValue as string[]).flatMap((v) => v.split(entry.delimiter!))
          : (rawValue as string[]);
        flags[name] = await convertItemList(convert, target, items, entry);
      } else {
        flags[name] = convert
          ? await convert(rawValue as string, target)
          : rawValue;
      }

      continue;
    }

    const envValue = entry.env ? env[entry.env] : undefined;
    if (envValue !== undefined && envValue !== "") {
      provided.add(name);
      flags[name] = await resolveEnvValue(entry, envValue);

      continue;
    }

    if (entry.default !== undefined) {
      flags[name] = evaluateDefault(entry.default);

      continue;
    }

    if (entry.required) {
      missingRequired.push(name);

      continue;
    }

    flags[name] = implicitDefault(kind);
  }

  return { flags, missingRequired, provided };
}

export function warnFlagDeprecations(
  compiled: CompiledFlags,
  provided: ReadonlySet<string>,
  warn: (message: string) => void,
): void {
  for (const name of provided) {
    const entry = compiled.byName.get(name);
    if (!entry?.deprecated) {
      continue;
    }
    const reason =
      typeof entry.deprecated === "string" ? `: ${entry.deprecated}` : "";
    warn(`Option '${entry.target}' is deprecated${reason}`);
  }
}

export function validateParsedFlags(
  compiled: CompiledFlags,
  knownFlagNames: readonly string[],
  parsed: {
    readonly unknown: Readonly<Record<string, unknown>>;
    readonly missingValueFlags: readonly string[];
    readonly missingValueCandidates?: Readonly<Record<string, string>>;
    readonly invalidValues: readonly InvalidFlagValue[];
  },
  strictFlags = true,
): void {
  if (parsed.missingValueFlags.length > 0) {
    const hints: string[] = [];
    for (const flag of parsed.missingValueFlags) {
      const candidate = parsed.missingValueCandidates?.[flag];
      if (candidate) {
        const target =
          compiled.byName.get(flag)?.target ?? formatFlagName(flag);
        hints.push(
          `if '${candidate}' is intended as the value, pass it as '${target}=${candidate}'`,
        );
      }
    }

    throw new MissingFlagValueError(
      parsed.missingValueFlags,
      hints.length > 0 ? hints : undefined,
    );
  }

  if (strictFlags) {
    const unknownKeys = Object.keys(parsed.unknown);
    if (unknownKeys.length > 0) {
      const hints: string[] = [];
      for (const unknown of unknownKeys) {
        if (unknown.length <= 1) {
          continue;
        }
        const suggestion = findClosest(kebabCase(unknown), knownFlagNames, 3);
        if (suggestion) {
          hints.push(
            `a similar option exists: '${formatFlagName(suggestion)}'`,
          );
        }
      }

      throw new UnknownFlagError(unknownKeys, hints);
    }
  }

  const firstInvalid = parsed.invalidValues[0];
  if (firstInvalid) {
    const target =
      compiled.byName.get(firstInvalid.flag)?.target ??
      formatFlagName(firstInvalid.flag);

    throw new ValidationError(target, firstInvalid.value, [
      { message: firstInvalid.message },
    ]);
  }
}

export function validateMissingRequiredFlags(
  compiled: CompiledFlags,
  missingRequired: readonly string[],
): void {
  if (missingRequired.length > 0) {
    const hints: string[] = [];
    for (const name of missingRequired) {
      const entry = compiled.byName.get(name);
      if (entry?.env) {
        hints.push(`provide '${entry.target}' or set ${entry.env}`);
      }
    }

    throw new MissingRequiredFlagError(
      missingRequired,
      hints.length > 0 ? hints : undefined,
    );
  }
}
