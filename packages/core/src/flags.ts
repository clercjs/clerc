import type {
  FlagDefinitionValue as ParserFlagDefinitionValue,
  FlagsDefinition as ParserFlagsDefinition,
  TypeValue as ParserTypeValue,
} from "@clerc/parser";
import { inferDefault } from "@clerc/parser";

import {
  FlagConflictError,
  FlagImpliesError,
  MissingRequiredFlagError,
  UnknownFlagError,
} from "./errors";
import type { FlagKind, TypeConverter } from "./schema";
import { describeType, isStandardSchema } from "./schema";
import { findClosest } from "./suggest";
import type {
  ClercFlagDefinitionValue,
  ClercFlagOptions,
  ClercFlagsDefinition,
  CoreTypeValue,
} from "./types";
import { formatFlagName, toArray } from "./utils";

export interface CompiledFlagEntry {
  readonly name: string;
  readonly norm: ClercFlagOptions;
  readonly target: string;
  readonly kind: FlagKind;
  readonly parserType: ParserTypeValue;
  readonly convert?: TypeConverter;
}

export interface CompiledFlags {
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

export function compileFlags(flags: ClercFlagsDefinition): CompiledFlags {
  const byName = new Map<string, CompiledFlagEntry>();
  const parserFlags: ParserFlagsDefinition = {};

  for (const name of Object.keys(flags)) {
    const norm = normalizeFlagValue(flags[name]);
    const { kind, parserType, convert } = describeType(norm.type);

    byName.set(name, {
      name,
      norm,
      target: formatFlagName(name),
      kind,
      parserType,
      convert,
    });

    const opts: Record<string, unknown> = { type: parserType };
    if (norm.short !== undefined) {
      opts.short = norm.short;
    }
    if (norm.negatable !== undefined && kind === "boolean") {
      opts.negatable = norm.negatable;
    }
    parserFlags[name] = opts as ParserFlagDefinitionValue;
  }

  return { byName, parserFlags };
}

async function convertValues(
  entry: CompiledFlagEntry,
  items: readonly string[],
): Promise<unknown[]> {
  if (!entry.convert) {
    return [...items];
  }
  const converted: unknown[] = [];
  for (const item of items) {
    converted.push(await entry.convert(item, entry.target));
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

  for (const entry of compiled.byName.values()) {
    const { name, norm, kind, target, convert } = entry;
    const rawValue = rawFlags[name];

    if (provided.has(name)) {
      flags[name] = convert
        ? kind === "array"
          ? await convertValues(entry, rawValue as string[])
          : await convert(rawValue as string, target)
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

    flags[name] = inferDefault(entry.parserType);
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
