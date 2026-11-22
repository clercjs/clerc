import type {
  FlagDefinitionValue as ParserFlagDefinitionValue,
  FlagsDefinition as ParserFlagsDefinition,
  TypeFunction,
} from "@clerc/parser";
import { inferDefault } from "@clerc/parser";

import { FlagConflictError, FlagImpliesError } from "./errors";
import { normalizeFlagValue } from "./parameter";
import { convertValue, convertValueSync, isStandardSchema } from "./schema";
import type {
  ClercFlagOptions,
  ClercFlagsDefinition,
  CoreSingleType,
  CoreTypeValue,
} from "./types";
import { formatFlagName, toArray } from "./utils";

const isArrayType = (type: CoreTypeValue): type is readonly [CoreSingleType] =>
  Array.isArray(type);

const isCounterType = (type: CoreTypeValue): boolean =>
  Array.isArray(type) && type[0] === Boolean;

function isDeferredValidationType(type: CoreTypeValue): boolean {
  if (isArrayType(type)) {
    const inner = type[0];

    return inner !== Boolean && inner !== String;
  }

  return type !== Boolean && type !== Object && type !== String;
}

export interface CompiledFlagEntry {
  readonly name: string;
  readonly norm: ClercFlagOptions;
  readonly target: string;
  readonly isArray: boolean;
  readonly isCounter: boolean;
  readonly isDeferred: boolean;
  readonly innerType: CoreSingleType;
  readonly innerIsSchema: boolean;
  readonly implicitDefault: unknown;
}

export interface CompiledFlags {
  readonly entries: readonly CompiledFlagEntry[];
  readonly byName: ReadonlyMap<string, CompiledFlagEntry>;
  readonly parserFlags: ParserFlagsDefinition;
}

const convertEntry = (entry: CompiledFlagEntry, raw: string) =>
  entry.innerIsSchema
    ? convertValue(entry.innerType, raw, entry.target)
    : convertValueSync(entry.innerType as TypeFunction<any>, raw, entry.target);

export function compileFlags(flags: ClercFlagsDefinition): CompiledFlags {
  const entries: CompiledFlagEntry[] = [];
  const byName = new Map<string, CompiledFlagEntry>();
  const parserFlags: ParserFlagsDefinition = {};

  for (const name in flags) {
    if (!Object.hasOwn(flags, name)) {
      continue;
    }
    const norm = normalizeFlagValue(flags[name]);
    const isArray = isArrayType(norm.type);
    const isCounter = isCounterType(norm.type);
    const isDeferred = isDeferredValidationType(norm.type);
    const innerType: CoreSingleType = isArray ? norm.type[0] : norm.type;
    const innerIsSchema = isStandardSchema(innerType);
    const implicitDefault = isStandardSchema(norm.type)
      ? undefined
      : isArray && innerIsSchema
        ? []
        : inferDefault(norm.type as any);

    const entry: CompiledFlagEntry = {
      name,
      norm,
      target: formatFlagName(name),
      isArray,
      isCounter,
      isDeferred,
      innerType,
      innerIsSchema,
      implicitDefault,
    };
    entries.push(entry);
    byName.set(name, entry);

    const opts: Record<string, unknown> = {
      type: isDeferred ? (isArray ? [String] : String) : (norm.type as any),
    };
    if (norm.short !== undefined) {
      opts.short = norm.short;
    }
    if (norm.negatable !== undefined && norm.type === Boolean) {
      opts.negatable = norm.negatable;
    }
    parserFlags[name] = opts as ParserFlagDefinitionValue;
  }

  return { entries, byName, parserFlags };
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
    const { name, norm, isArray, isCounter, isDeferred } = entry;
    const rawValue = rawFlags[name];

    // 1. Explicitly supplied on CLI
    if (provided.has(name)) {
      if (!isDeferred) {
        flags[name] = rawValue;
      } else if (isArray) {
        const converted: unknown[] = [];
        for (const item of rawValue as string[]) {
          converted.push(await convertEntry(entry, item));
        }
        flags[name] = converted;
      } else {
        flags[name] = await convertEntry(entry, rawValue as string);
      }

      continue;
    }

    // 2. Environment variable fallback
    const envValue = norm.env ? env[norm.env] : undefined;
    if (envValue !== undefined && envValue !== "") {
      provided.add(name);
      if (norm.type === Boolean) {
        flags[name] = envValue !== "0" && envValue.toLowerCase() !== "false";
      } else if (isCounter) {
        const count = Number(envValue);
        flags[name] = Number.isNaN(count) ? 0 : count;
      } else if (isArray) {
        const converted: unknown[] = [];
        for (const item of envValue.split(",")) {
          converted.push(await convertEntry(entry, item.trim()));
        }
        flags[name] = converted;
      } else if (norm.type === Object) {
        flags[name] = rawValue ?? {};
      } else {
        flags[name] = await convertEntry(entry, envValue);
      }

      continue;
    }

    // 3. Explicit default
    if (norm.default !== undefined) {
      flags[name] =
        typeof norm.default === "function"
          ? (norm.default as () => unknown)()
          : norm.default;

      continue;
    }

    // 4. Required check
    if (norm.required) {
      missingRequired.push(name);

      continue;
    }

    // 5. Implicit default from type
    flags[name] =
      isArray && Array.isArray(entry.implicitDefault)
        ? []
        : norm.type === Object
          ? {}
          : entry.implicitDefault;
  }

  return { flags, missingRequired, provided };
}

export function checkFlagConstraints(
  compiled: CompiledFlags,
  provided: ReadonlySet<string>,
): void {
  for (const name of provided) {
    const entry = compiled.byName.get(name);
    if (!entry) {
      continue;
    }
    const { norm } = entry;
    if (norm.conflicts) {
      for (const other of toArray(norm.conflicts)) {
        if (provided.has(other)) {
          throw new FlagConflictError(name, other);
        }
      }
    }
    if (norm.implies) {
      for (const required of toArray(norm.implies)) {
        if (!provided.has(required)) {
          throw new FlagImpliesError(name, required);
        }
      }
    }
  }
}
