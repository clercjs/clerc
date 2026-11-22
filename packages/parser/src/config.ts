import { InvalidSchemaError } from "./errors";
import { camelCase, looseIsArray } from "./helpers";
import type {
  FlagDefinitionValue,
  FlagOptions,
  FlagsDefinition,
} from "./types";

export const DEFAULT_DELIMITERS = ["=", ":"];

const normalizeConfig = (config: FlagDefinitionValue): FlagOptions =>
  typeof config === "function" || looseIsArray(config)
    ? { type: config }
    : config;

function hasInvalidChar(name: string, delimiters: readonly string[]): boolean {
  if (name.includes(" ") || name.includes(".")) {
    return true;
  }
  for (const delimiter of delimiters) {
    if (name.includes(delimiter)) {
      return true;
    }
  }

  return false;
}

function validateFlagOptions(
  name: string,
  options: FlagOptions,
  delimiters: readonly string[],
): void {
  if (Array.isArray(options.type) && options.type.length > 1) {
    throw new InvalidSchemaError(
      `Flag "${name}" has an invalid type array. Only single-element arrays are allowed to denote multiple occurrences.`,
    );
  }

  if (name.length < 2) {
    throw new InvalidSchemaError(
      `Flag "${name}" name must be at least 2 characters long.`,
    );
  }

  if (options.short !== undefined && options.short.length !== 1) {
    throw new InvalidSchemaError(
      `Flag "${name}" short flag must be exactly 1 character long.`,
    );
  }

  if (
    hasInvalidChar(name, delimiters) ||
    (options.short !== undefined && hasInvalidChar(options.short, delimiters))
  ) {
    throw new InvalidSchemaError(
      `Flag "${name}" contains reserved characters, which are used as delimiters.`,
    );
  }

  if (options.required && options.default !== undefined) {
    throw new InvalidSchemaError(
      `Flag "${name}" cannot be both required and have a default value.`,
    );
  }
}

export function buildConfigsAndAliases(
  delimiters: readonly string[],
  flags: FlagsDefinition,
): {
  configs: Map<string, FlagOptions>;
  aliases: Map<string, string>;
} {
  const configs = new Map<string, FlagOptions>();
  const aliases = new Map<string, string>();

  for (const name in flags) {
    if (!Object.hasOwn(flags, name)) {
      continue;
    }
    const normalized = normalizeConfig(flags[name]);
    validateFlagOptions(name, normalized, delimiters);

    configs.set(name, normalized);
    aliases.set(name, name);
    const camel = camelCase(name);
    if (camel !== name) {
      aliases.set(camel, name);
    }
    if (normalized.short) {
      aliases.set(normalized.short, name);
    }
  }

  return { configs, aliases };
}
