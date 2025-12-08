import { camelCase, toArray } from "@clerc/utils";

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

const BUILDTIN_DELIMITERS_RE = /[\s.]/;

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
		BUILDTIN_DELIMITERS_RE.test(name);

	function validateFlagOptions(name: string, options: FlagOptions) {
		const prefix = `Flag "${name}"`;
		if (Array.isArray(options.type) && options.type.length > 1) {
			throw new InvalidSchemaError(
				`${prefix} has an invalid type array. Only single-element arrays are allowed to denote multiple occurrences.`,
			);
		}

		const names = [name];

		if (options.alias) {
			names.push(...toArray(options.alias));
		}

		if (names.some(isNameInvalid)) {
			throw new InvalidSchemaError(
				`${prefix} contains reserved characters, which are used as delimiters.`,
			);
		}
	}

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
