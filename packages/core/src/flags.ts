import type {
  FlagDefinitionValue as ParserFlagDefinitionValue,
  FlagsDefinition as ParserFlagsDefinition,
} from "@clerc/parser";

import { FlagConflictError, FlagImpliesError } from "./errors";
import { convertValue, isStandardSchema } from "./schema";
import type {
  ClercFlagDefinitionValue,
  ClercFlagOptions,
  ClercFlagsDefinition,
  CoreSingleType,
  CoreTypeValue,
} from "./types";
import { formatFlagName, toArray } from "./utils";

type FlagKind = "boolean" | "counter" | "object" | "array" | "single";

export interface CompiledFlagEntry {
  readonly name: string;
  readonly norm: ClercFlagOptions;
  readonly target: string;
  readonly kind: FlagKind;
  readonly valueType: CoreSingleType;
  readonly needsConvert: boolean;
}

export interface CompiledFlags {
  readonly entries: readonly CompiledFlagEntry[];
  readonly byName: ReadonlyMap<string, CompiledFlagEntry>;
  readonly parserFlags: ParserFlagsDefinition;
}

export function normalizeFlagValue(
  flag: ClercFlagDefinitionValue,
): ClercFlagOptions {
  if (
    typeof flag === "function" ||
    Array.isArray(flag) ||
    isStandardSchema(flag)
  ) {
    return { type: flag as CoreTypeValue };
  }

  return flag as ClercFlagOptions;
}

const isArrayType = (type: CoreTypeValue): type is readonly [CoreSingleType] =>
  Array.isArray(type);

function classifyFlagType(type: CoreTypeValue): {
  kind: FlagKind;
  valueType: CoreSingleType;
  parserType: ParserFlagDefinitionValue;
  needsConvert: boolean;
} {
  if (isArrayType(type)) {
    const inner = type[0];
    if (inner === Boolean) {
      return {
        kind: "counter",
        valueType: Boolean,
        parserType: [Boolean],
        needsConvert: false,
      };
    }

    return {
      kind: "array",
      valueType: inner,
      parserType: [String],
      needsConvert: inner !== String,
    };
  }

  if (type === Boolean) {
    return {
      kind: "boolean",
      valueType: Boolean,
      parserType: Boolean,
      needsConvert: false,
    };
  }
  if (type === Object) {
    return {
      kind: "object",
      valueType: Object,
      parserType: Object,
      needsConvert: false,
    };
  }

  return {
    kind: "single",
    valueType: type,
    parserType: String,
    needsConvert: type !== String,
  };
}

function createImplicitDefault(kind: FlagKind): unknown {
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
    case "object": {
      return {};
    }
    case "single": {
      return undefined;
    }
  }
}

export function compileFlags(flags: ClercFlagsDefinition): CompiledFlags {
  const entries: CompiledFlagEntry[] = [];
  const byName = new Map<string, CompiledFlagEntry>();
  const parserFlags: ParserFlagsDefinition = {};

  for (const name of Object.keys(flags)) {
    const norm = normalizeFlagValue(flags[name]);
    const { kind, valueType, parserType, needsConvert } = classifyFlagType(
      norm.type,
    );

    const entry: CompiledFlagEntry = {
      name,
      norm,
      target: formatFlagName(name),
      kind,
      valueType,
      needsConvert,
    };
    entries.push(entry);
    byName.set(name, entry);

    const opts: Record<string, unknown> = { type: parserType };
    if (norm.short !== undefined) {
      opts.short = norm.short;
    }
    if (norm.negatable !== undefined && kind === "boolean") {
      opts.negatable = norm.negatable;
    }
    parserFlags[name] = opts as ParserFlagDefinitionValue;
  }

  return { entries, byName, parserFlags };
}

async function resolveEnvValue(
  entry: CompiledFlagEntry,
  envValue: string,
  rawValue: unknown,
): Promise<unknown> {
  switch (entry.kind) {
    case "boolean": {
      return envValue !== "0" && envValue.toLowerCase() !== "false";
    }
    case "counter": {
      const count = Number(envValue);

      return Number.isNaN(count) ? 0 : count;
    }
    case "array": {
      const converted: unknown[] = [];
      for (const item of envValue.split(",")) {
        const trimmed = item.trim();
        converted.push(
          entry.needsConvert
            ? await convertValue(entry.valueType, trimmed, entry.target)
            : trimmed,
        );
      }

      return converted;
    }
    case "object": {
      return rawValue ?? {};
    }
    case "single": {
      return entry.needsConvert
        ? convertValue(entry.valueType, envValue, entry.target)
        : envValue;
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
    const { name, norm, kind, valueType, target, needsConvert } = entry;
    const rawValue = rawFlags[name];

    // 1. Explicitly supplied on CLI
    if (provided.has(name)) {
      if (!needsConvert) {
        flags[name] = rawValue;
      } else if (kind === "array") {
        const converted: unknown[] = [];
        for (const item of rawValue as string[]) {
          converted.push(await convertValue(valueType, item, target));
        }
        flags[name] = converted;
      } else {
        flags[name] = await convertValue(valueType, rawValue as string, target);
      }

      continue;
    }

    // 2. Environment variable fallback
    const envValue = norm.env ? env[norm.env] : undefined;
    if (envValue !== undefined && envValue !== "") {
      provided.add(name);
      flags[name] = await resolveEnvValue(entry, envValue, rawValue);

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

    // 5. Implicit default from kind (fresh instance per run)
    flags[name] = createImplicitDefault(kind);
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
