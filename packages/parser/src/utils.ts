import { InvalidSchemaError } from "./errors";
import type { FlagOptions, FlagOptionsValue, FlagsConfigSchema } from "./types";

export const isArrayOfType = (arr: any, type: any): boolean =>
	Array.isArray(arr) && arr[0] === type;

export function setValueByType(
	flags: any,
	key: string,
	value: string,
	config: FlagOptions,
) {
	const { type } = config;
	if (Array.isArray(type)) {
		if (isArrayOfType(type, Boolean)) {
			flags[key] = (flags[key] ?? 0) + 1;
		} else {
			(flags[key] ??= []).push(type[0](value));
		}
	} else {
		flags[key] = type(value);
	}
}

export function setDotValues(obj: any, path: string, value: any) {
	const keys = path.split(".");
	let current = obj;
	for (let i = 0; i < keys.length - 1; i++) {
		const key = keys[i];
		current[key] ??= {};
		current = current[key];
	}
	const lastKey = keys[keys.length - 1];
	if (value === "true" || value === "") {
		current[lastKey] = true;
	} else if (value === "false") {
		current[lastKey] = false;
	} else {
		current[lastKey] = value;
	}
}

export const toCamelCase = (str: string) =>
	str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
export const isNumber = (str: string) => !Number.isNaN(Number(str));
export const isFlag = (str: string) => str.startsWith("-") && !isNumber(str);

const normalizeConfig = (config: FlagOptionsValue): FlagOptions =>
	typeof config === "function" || Array.isArray(config)
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

export function buildConfigsAndAliases(flags: FlagsConfigSchema) {
	const configs = new Map<string, FlagOptions>();
	const aliases = new Map<string, string>();

	for (const [name, config] of Object.entries(flags)) {
		const normalized = normalizeConfig(config);
		validateFlagOptions(name, normalized);

		configs.set(name, normalized);
		aliases.set(name, name);
		aliases.set(toCamelCase(name), name);
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
