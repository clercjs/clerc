import type {
  FlagDefinitionValue as ParserFlagDefinitionValue,
  FlagsDefinition as ParserFlagsDefinition,
} from "@clerc/parser";
import { inferDefault } from "@clerc/parser";

import { FlagConflictError, FlagImpliesError } from "./errors";
import { normalizeFlagValue } from "./parameter";
import { convertValue, isStandardSchema } from "./schema";
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

/**
 * Projects Clerc flag definitions into lexical `@clerc/parser` flags.
 * Complex/validated types parse as raw strings here so `onIntercept` (e.g.
 * `--help`) can short-circuit before validation runs.
 */
export function toParserFlags(
  flags: ClercFlagsDefinition,
): ParserFlagsDefinition {
  const result: ParserFlagsDefinition = {};

  for (const [name, def] of Object.entries(flags)) {
    const norm = normalizeFlagValue(def);
    const parserType: ParserFlagDefinitionValue = isDeferredValidationType(
      norm.type,
    )
      ? isArrayType(norm.type)
        ? [String]
        : String
      : (norm.type as any);

    const opts: Record<string, unknown> = { type: parserType };
    if (norm.short !== undefined) {
      opts.short = norm.short;
    }
    if (norm.negatable !== undefined && norm.type === Boolean) {
      opts.negatable = norm.negatable;
    }
    result[name] = opts as ParserFlagDefinitionValue;
  }

  return result;
}

export async function resolveAndValidateFlags(
  mergedDefs: ClercFlagsDefinition,
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

  for (const [name, def] of Object.entries(mergedDefs)) {
    const norm = normalizeFlagValue(def);
    const target = formatFlagName(name);
    const rawValue = rawFlags[name];

    // 1. Explicitly supplied on CLI (accurately tracked by @clerc/parser — handles --no-flag with default: true!)
    if (provided.has(name)) {
      if (isDeferredValidationType(norm.type)) {
        if (isArrayType(norm.type)) {
          const converted: unknown[] = [];
          for (const item of rawValue as string[]) {
            converted.push(await convertValue(norm.type[0], item, target));
          }
          flags[name] = converted;
        } else {
          flags[name] = await convertValue(
            norm.type as CoreSingleType,
            rawValue as string,
            target,
          );
        }
      } else {
        flags[name] = rawValue;
      }

      continue;
    }

    // 2. Environment variable fallback
    const envValue = norm.env ? env[norm.env] : undefined;
    if (envValue !== undefined && envValue !== "") {
      provided.add(name);
      if (norm.type === Boolean) {
        flags[name] = envValue !== "0" && envValue.toLowerCase() !== "false";
      } else if (isCounterType(norm.type)) {
        const count = Number(envValue);
        flags[name] = Number.isNaN(count) ? 0 : count;
      } else if (isArrayType(norm.type)) {
        const converted: unknown[] = [];
        for (const item of envValue.split(",").map((s) => s.trim())) {
          converted.push(await convertValue(norm.type[0], item, target));
        }
        flags[name] = converted;
      } else if (norm.type === Object) {
        flags[name] = rawValue ?? {};
      } else {
        flags[name] = await convertValue(
          norm.type as CoreSingleType,
          envValue,
          target,
        );
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
    flags[name] = isStandardSchema(norm.type)
      ? undefined
      : isArrayType(norm.type) && isStandardSchema(norm.type[0])
        ? []
        : inferDefault(norm.type as any);
  }

  return { flags, missingRequired, provided };
}

export function checkFlagConstraints(
  mergedDefs: ClercFlagsDefinition,
  provided: ReadonlySet<string>,
): void {
  for (const name of provided) {
    const def = mergedDefs[name];
    if (!def) {
      continue;
    }
    const norm: ClercFlagOptions = normalizeFlagValue(def);
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
