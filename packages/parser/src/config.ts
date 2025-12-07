import { camelCase } from "@clerc/utils";

import { InvalidSchemaError } from "./errors";
import type {
	FlagDefinitionValue,
	FlagOptions,
	FlagsDefinition,
	ParserOptions,
	PartialRequired,
} from "./types";
import { looseIsArray } from "./utils";

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

const RESERVED_CHARACTERS_PATTERN = /[\s.:=]/;

function validateFlagOptions(name: string, options: FlagOptions) {
	const prefix = `Flag "${name}"`;
	if (Array.isArray(options.type) && options.type.length > 1) {
		throw new InvalidSchemaError(
			`${prefix} has an invalid type array. Only single-element arrays are allowed to denote multiple occurrences.`,
		);
	}
	if (RESERVED_CHARACTERS_PATTERN.test(name)) {
		throw new InvalidSchemaError(
			`${prefix} contains reserved characters (spaces, dots, colons, equals signs).`,
		);
	}
}

export function buildConfigsAndAliases(flags: FlagsDefinition): {
	configs: Map<string, FlagOptions>;
	aliases: Map<string, string>;
} {
	const configs = new Map<string, FlagOptions>();
	const aliases = new Map<string, string>();

	for (const [name, config] of Object.entries(flags)) {
		const normalized = normalizeConfig(config);
		validateFlagOptions(name, normalized);

		configs.set(name, normalized);
		aliases.set(name, name);
		aliases.set(camelCase(name), name);
		if (normalized.alias) {
			const list = Array.isArray(normalized.alias)
				? normalized.alias
				: [normalized.alias];
			for (const a of list) {
				aliases.set(a, name);
			}
		}
	}

	return { configs, aliases };
}
