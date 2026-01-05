import type { PartialRequired } from "@clerc/utils";
import { camelCase, looseIsArray } from "@clerc/utils";

import { InvalidSchemaError } from "./errors";
import type {
  FlagDefinitionValue,
  FlagOptions,
  FlagsDefinition,
  ParserOptions,
} from "./types";

const defaultParserOptions = {
  delimiters: ["=", ":"],
} satisfies ParserOptions;

export const resolveParserOptions = (
  options: ParserOptions = {},
): PartialRequired<ParserOptions, "delimiters"> => ({
  ...defaultParserOptions,
  ...options,
});

const normalizeConfig = (config: FlagDefinitionValue): FlagOptions =>
  typeof config === "function" || looseIsArray(config)
    ? { type: config }
    : config;

const BUILTIN_DELIMITERS_RE = /[\s.]/;

export function buildConfigsAndAliases(
  delimiters: string[],
  flags: FlagsDefinition,
): {
  configs: Map<string, FlagOptions>;
  aliases: Map<string, string>;
} {
  const configs = new Map<string, FlagOptions>();
  const aliases = new Map<string, string>();

  const isNameInvalid = (name: string) =>
    delimiters.some((char) => name.includes(char)) ||
    BUILTIN_DELIMITERS_RE.test(name);

  function validateFlagOptions(name: string, options: FlagOptions) {
    const prefix = `Flag "${name}"`;
    if (Array.isArray(options.type) && options.type.length > 1) {
      throw new InvalidSchemaError(
        `${prefix} has an invalid type array. Only single-element arrays are allowed to denote multiple occurrences.`,
      );
    }

    // Validate flag name must be at least 2 characters
    if (name.length < 2) {
      throw new InvalidSchemaError(
        `${prefix} name must be at least 2 characters long.`,
      );
    }

    const names = [name];

    // Validate short flag must be exactly 1 character
    if (options.short) {
      if (options.short.length !== 1) {
        throw new InvalidSchemaError(
          `${prefix} short flag must be exactly 1 character long.`,
        );
      }
      names.push(options.short);
    }

    if (names.some(isNameInvalid)) {
      throw new InvalidSchemaError(
        `${prefix} contains reserved characters, which are used as delimiters.`,
      );
    }

    if (options.required && options.default !== undefined) {
      throw new InvalidSchemaError(
        `${prefix} cannot be both required and have a default value.`,
      );
    }
  }

  for (const [name, config] of Object.entries(flags)) {
    const normalized = normalizeConfig(config);
    validateFlagOptions(name, normalized);

    configs.set(name, normalized);
    aliases.set(name, name);
    aliases.set(camelCase(name), name);
    if (normalized.short) {
      aliases.set(normalized.short, name);
    }
  }

  return { configs, aliases };
}
