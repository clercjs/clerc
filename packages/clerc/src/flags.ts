import {
  FlagConflictError,
  FlagImpliesError,
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
import type { FlagKind, TypeConverter } from "./schema";
import { describeType, isStandardSchema } from "./schema";
import { findClosest } from "./suggest";
import type {
  FlagDefinitionValue,
  FlagDescriptor,
  FlagOptions,
  FlagsDefinition,
  TypeValue,
} from "./types";
import {
  camelCase,
  evaluateDefault,
  formatFlagName,
  kebabCase,
  toArray,
} from "./utils";

export interface CompiledFlagEntry extends FlagDescriptor {
  readonly convert?: TypeConverter;
}

export interface CompiledFlags {
  readonly descriptors: readonly FlagDescriptor[];
  readonly entries: readonly CompiledFlagEntry[];
  readonly byName: ReadonlyMap<string, CompiledFlagEntry>;
  readonly specs: readonly ArgvFlagSpec[];
  readonly knownNames: readonly string[];
}

function normalizeFlagValue(flag: FlagDefinitionValue): FlagOptions {
  if (
    typeof flag === "function" ||
    Array.isArray(flag) ||
    isStandardSchema(flag)
  ) {
    return { type: flag as TypeValue };
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
): FlagDescriptor => ({
  name,
  target: formatFlagName(name),
  short,
  aliases: [],
  kind: "boolean",
  display: "boolean",
  description,
  required: false,
  negatable: false,
  hidden: false,
  conflicts: [],
  implies: [],
  toJsonSchema: () => ({ type: "boolean" }),
});

export function compileFlags(flags: FlagsDefinition): CompiledFlags {
  const entries: CompiledFlagEntry[] = [];
  const byName = new Map<string, CompiledFlagEntry>();
  const specs: ArgvFlagSpec[] = [];
  const knownNames: string[] = [];

  for (const name of Object.keys(flags)) {
    const norm = normalizeFlagValue(flags[name]);
    if (Array.isArray(norm.type) && norm.type.length !== 1) {
      throw new InvalidSchemaError(
        `Flag "${name}" has an invalid type array. Only single-element arrays are allowed to denote multiple occurrences.`,
      );
    }
    if (norm.required && norm.default !== undefined) {
      throw new InvalidSchemaError(
        `Flag "${name}" cannot be both required and have a default value.`,
      );
    }

    const { kind, display, convert, toJsonSchema } = describeType(norm.type);
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
      required: Boolean(norm.required),
      env: norm.env,
      negatable,
      group: norm.group,
      hidden: Boolean(norm.hidden),
      deprecated: norm.deprecated,
      conflicts: norm.conflicts ? toArray(norm.conflicts) : [],
      implies: norm.implies ? toArray(norm.implies) : [],
      meta: norm.meta,
      toJsonSchema,
      convert,
    };

    entries.push(entry);
    byName.set(name, entry);
    specs.push({
      key: name,
      kind,
      short: norm.short,
      aliases: aliases.length > 0 ? aliases : undefined,
      negatable: kind === "boolean" ? negatable : undefined,
      optionalValue: norm.implicitValue !== undefined,
    });
    knownNames.push(name, ...aliases);
  }

  return { descriptors: entries, entries, byName, specs, knownNames };
}

export function mergeCompiledFlags(
  globalFlags: CompiledFlags,
  localFlags: CompiledFlags,
): CompiledFlags {
  if (localFlags.entries.length === 0) {
    return globalFlags;
  }

  const entries: CompiledFlagEntry[] = [];
  const byName = new Map<string, CompiledFlagEntry>();
  const specs: ArgvFlagSpec[] = [];
  const knownNames: string[] = [];

  for (const entry of globalFlags.entries) {
    if (localFlags.byName.has(entry.name)) {
      continue;
    }
    entries.push(entry);
    byName.set(entry.name, entry);
    specs.push({
      key: entry.name,
      kind: entry.kind,
      short: entry.short,
      aliases: entry.aliases.length > 0 ? entry.aliases : undefined,
      negatable: entry.kind === "boolean" ? entry.negatable : undefined,
      optionalValue: entry.implicitValue !== undefined,
    });
    knownNames.push(entry.name, ...entry.aliases);
  }

  for (const [i, entry] of localFlags.entries.entries()) {
    entries.push(entry);
    byName.set(entry.name, entry);
    specs.push(localFlags.specs[i]);
    knownNames.push(entry.name, ...entry.aliases);
  }

  return { descriptors: entries, entries, byName, specs, knownNames };
}

export function finalizeCompiledFlags(compiled: CompiledFlags): CompiledFlags {
  const canonicalByRef = new Map<string, string>();
  for (const entry of compiled.entries) {
    for (const raw of [entry.name, ...entry.aliases]) {
      canonicalByRef.set(raw, entry.name);
      canonicalByRef.set(camelCase(raw), entry.name);
      canonicalByRef.set(kebabCase(raw), entry.name);
    }
    if (entry.short) {
      canonicalByRef.set(entry.short, entry.name);
    }
  }

  function resolveRef(
    owner: string,
    raw: string,
    relation: "conflicts with" | "implies",
  ): string {
    const stripped = raw.replace(/^-+/, "");
    const target = stripped ? canonicalByRef.get(stripped) : undefined;
    if (!target) {
      throw new InvalidSchemaError(
        `Flag "${owner}" ${relation} unknown flag "${raw}".`,
      );
    }
    if (target === owner) {
      throw new InvalidSchemaError(
        `Flag "${owner}" cannot ${relation === "implies" ? "imply" : "conflict with"} itself.`,
      );
    }

    return target;
  }

  let changed = false;
  const entries = compiled.entries.map((entry) => {
    if (entry.conflicts.length === 0 && entry.implies.length === 0) {
      return entry;
    }
    changed = true;
    const conflicts = [
      ...new Set(
        entry.conflicts.map((c) => resolveRef(entry.name, c, "conflicts with")),
      ),
    ];
    const implies = [
      ...new Set(
        entry.implies.map((im) => resolveRef(entry.name, im, "implies")),
      ),
    ];

    return { ...entry, conflicts, implies };
  });

  if (!changed) {
    return compiled;
  }

  const byName = new Map(entries.map((e) => [e.name, e]));

  return {
    ...compiled,
    descriptors: entries,
    entries,
    byName,
  };
}

export async function convertItemList(
  convert: TypeConverter | undefined,
  target: string,
  items: readonly string[],
): Promise<unknown[]> {
  if (!convert) {
    return [...items];
  }
  const converted: unknown[] = [];
  for (const item of items) {
    converted.push(await convert(item, target));
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
        flags[name] = await convertItemList(convert, target, items);
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
        const suggestion = findClosest(unknown, knownFlagNames, 3);
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

export function validateResolvedFlags(
  compiled: CompiledFlags,
  missingRequired: readonly string[],
  provided: ReadonlySet<string>,
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

  for (const name of provided) {
    const entry = compiled.byName.get(name);
    if (!entry) {
      continue;
    }
    for (const other of entry.conflicts) {
      if (provided.has(other)) {
        throw new FlagConflictError(name, other);
      }
    }
    for (const required of entry.implies) {
      if (!provided.has(required)) {
        throw new FlagImpliesError(name, required);
      }
    }
  }
}
