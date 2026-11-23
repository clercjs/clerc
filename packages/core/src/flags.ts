import type {
  FlagDefinitionValue as ParserFlagDefinitionValue,
  FlagsDefinition as ParserFlagsDefinition,
} from "@clerc/parser";

import {
  FlagConflictError,
  FlagImpliesError,
  MissingRequiredFlagError,
  UnknownFlagError,
} from "./errors";
import { convertValue, isStandardSchema } from "./schema";
import { findClosest } from "./suggest";
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

  if (type === Boolean || type === Object) {
    return {
      kind: type === Boolean ? "boolean" : "object",
      valueType: type,
      parserType: type,
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

async function convertValues(
  entry: CompiledFlagEntry,
  items: readonly string[],
): Promise<unknown[]> {
  if (!entry.needsConvert) {
    return [...items];
  }
  const converted: unknown[] = [];
  for (const item of items) {
    converted.push(await convertValue(entry.valueType, item, entry.target));
  }

  return converted;
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
      return convertValues(
        entry,
        envValue.split(",").map((s) => s.trim()),
      );
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

    if (provided.has(name)) {
      flags[name] = needsConvert
        ? kind === "array"
          ? await convertValues(entry, rawValue as string[])
          : await convertValue(valueType, rawValue as string, target)
        : rawValue;

      continue;
    }

    const envValue = norm.env ? env[norm.env] : undefined;
    if (envValue !== undefined && envValue !== "") {
      provided.add(name);
      flags[name] = await resolveEnvValue(entry, envValue, rawValue);

      continue;
    }

    if (norm.default !== undefined) {
      flags[name] =
        typeof norm.default === "function"
          ? (norm.default as () => unknown)()
          : norm.default;

      continue;
    }

    if (norm.required) {
      missingRequired.push(name);

      continue;
    }

    flags[name] = createImplicitDefault(kind);
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
    if (!entry?.norm.deprecated) {
      continue;
    }
    const reason =
      typeof entry.norm.deprecated === "string"
        ? `: ${entry.norm.deprecated}`
        : "";
    warn(`Option '${entry.target}' is deprecated${reason}`);
  }
}

export function validateCompiledFlags(
  compiled: CompiledFlags,
  missingRequired: readonly string[],
  provided: ReadonlySet<string>,
  unknownFlags?: Readonly<Record<string, unknown>>,
  strictFlags = true,
): void {
  if (strictFlags && unknownFlags) {
    const unknownKeys = Object.keys(unknownFlags);
    if (unknownKeys.length > 0) {
      const knownFlags = [...compiled.byName.keys()];
      const hints: string[] = [];
      for (const unknown of unknownKeys) {
        if (unknown.length <= 1) {
          continue;
        }
        const suggestion = findClosest(unknown, knownFlags, 3);
        if (suggestion) {
          hints.push(
            `a similar option exists: '${formatFlagName(suggestion)}'`,
          );
        }
      }

      throw new UnknownFlagError(unknownKeys, hints);
    }
  }

  if (missingRequired.length > 0) {
    const hints: string[] = [];
    for (const name of missingRequired) {
      const entry = compiled.byName.get(name);
      if (entry?.norm.env) {
        hints.push(`provide '${entry.target}' or set ${entry.norm.env}`);
      }
    }

    throw new MissingRequiredFlagError(
      missingRequired,
      hints.length > 0 ? hints : undefined,
    );
  }

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
