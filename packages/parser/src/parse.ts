import { buildConfigsAndAliases, resolveParserOptions } from "./config";
import type {
	FlagOptionsValue,
	InferFlags,
	ParsedResult,
	ParserOptions,
} from "./types";
import {
	isArrayOfType,
	setDotValues,
	setValueByType,
	splitNameAndValue,
	toCamelCase,
} from "./utils";

const FLAG_ALPHA_PATTERN = /^-{1,2}[a-z]/i;
const FLAG_NUMBER_PATTERN = /^-{1,2}\d/;
const DOUBLE_DASH = "--";

export function createParser<T extends Record<string, FlagOptionsValue>>(
	options: ParserOptions<T> = {},
) {
	const { flags: flagsConfig = {}, delimiters } = resolveParserOptions(options);
	const { configs, aliases } = buildConfigsAndAliases(flagsConfig);

	function resolve(name: string) {
		const dotIdx = name.indexOf(".");
		const rootName = dotIdx === -1 ? name : name.slice(0, dotIdx);

		const key = aliases.get(rootName) ?? aliases.get(toCamelCase(rootName));
		if (!key) {
			return undefined;
		}

		const config = configs.get(key)!;

		return {
			key,
			config,
			path: dotIdx === -1 ? undefined : name.slice(dotIdx + 1),
		};
	}

	function shouldProcessAsFlag(arg: string) {
		if (FLAG_ALPHA_PATTERN.test(arg)) {
			return true;
		}

		if (FLAG_NUMBER_PATTERN.test(arg)) {
			const isAlias = !arg.startsWith(DOUBLE_DASH);
			const name = isAlias ? arg.slice(1, 2) : arg.slice(2);

			return !!resolve(name);
		}

		return false;
	}

	function parse(args: string[]): ParsedResult<InferFlags<T>> {
		const result: ParsedResult<any> = {
			parameters: [],
			doubleDash: [],
			flags: {},
			raw: args,
			unknown: {},
		};

		for (let i = 0; i < args.length; i++) {
			const arg = args[i];
			if (arg === DOUBLE_DASH) {
				result.doubleDash.push(...args.slice(i + 1));
				break;
			}

			if (!shouldProcessAsFlag(arg)) {
				result.parameters.push(arg);
				continue;
			}

			const isAlias = !arg.startsWith(DOUBLE_DASH);
			const chars = arg.slice(isAlias ? 1 : 2);

			// -abc
			if (isAlias) {
				for (let j = 0; j < chars.length; j++) {
					const char = chars[j];
					const resolved = resolve(char);

					if (!resolved) {
						result.unknown[char] = true;
						continue;
					}

					const { key, config } = resolved;

					if (config.type === Boolean || isArrayOfType(config.type, Boolean)) {
						setValueByType(result.flags, key, "true", config);
					} else {
						if (j + 1 < chars.length) {
							// -abval, b's type is not Boolean
							// set b to 'val'
							setValueByType(result.flags, key, chars.slice(j + 1), config);
							j = chars.length;
						} else {
							// -ab foo, we are on "b"
							const next = args[i + 1];
							if (next && !shouldProcessAsFlag(next)) {
								setValueByType(result.flags, key, args[++i], config);
							}
							// else {
							// 	setValueByType(result.flags, key, "", config);
							// }
						}
					}
				}
			}
			// --flag
			else {
				// Support both --name=value and --name:value forms. The ':' form
				// is useful when the value itself contains '=' (e.g. --define:K=V).
				const { rawName, rawValue, hasSep } = splitNameAndValue(
					chars,
					delimiters,
				);

				let resolved = resolve(rawName);
				let isNegated = false;

				// Try to resolve negated boolean flags: --no-foo or --noFoo
				if (!resolved && rawName.startsWith("no")) {
					const positiveName =
						rawName[2] === "-"
							? rawName.slice(3) // --no-foo -> foo
							: rawName.length > 2 && /[A-Z]/.test(rawName[2])
								? rawName[2].toLowerCase() + rawName.slice(3) // --noFoo -> foo
								: "";

					if (positiveName) {
						const positiveResolved = resolve(positiveName);
						if (
							positiveResolved?.config.type === Boolean &&
							(positiveResolved.config as any).negatable !== false
						) {
							resolved = positiveResolved;
							isNegated = true;
						}
					}
				}
				if (!resolved) {
					const key = toCamelCase(rawName);
					if (hasSep) {
						result.unknown[key] = rawValue!;
					} else {
						const next = args[i + 1];
						if (next && !shouldProcessAsFlag(next)) {
							result.unknown[key] = next;
							i++;
						} else {
							result.unknown[key] = true;
						}
					}
					continue;
				}

				const { key, config, path } = resolved;

				if (path) {
					if (config.type === Object) {
						result.flags[key] ??= {};
						const value = hasSep
							? rawValue!
							: args[i + 1] && !shouldProcessAsFlag(args[i + 1])
								? args[++i]
								: "";
						setDotValues(result.flags[key], path, value);
					}
				} else {
					if (config.type === Boolean) {
						const value = hasSep ? rawValue !== "false" : true;
						result.flags[key] = isNegated ? !value : value;
					} else {
						const next = args[i + 1];
						const value = hasSep
							? rawValue!
							: next && !shouldProcessAsFlag(next)
								? args[++i]
								: "";
						setValueByType(result.flags, key, value, config);
					}
				}
			}
		}

		// Apply defaults
		for (const [key, config] of configs.entries()) {
			const val = result.flags[key];
			if (val === undefined) {
				if (config.default !== undefined) {
					result.flags[key] =
						typeof config.default === "function"
							? config.default()
							: config.default;
				}
				// Make sure arrays and objects are always initialized with default values
				else if (Array.isArray(config.type)) {
					result.flags[key] = isArrayOfType(config.type, Boolean) ? 0 : [];
				} else if (config.type === Object) {
					result.flags[key] = {};
				}
				// Initialize negatable booleans to false if not provided
				else if (config.type === Boolean) {
					result.flags[key] = false;
				}
			}
		}

		return result;
	}

	return { parse };
}

export const parse = <T extends Record<string, FlagOptionsValue>>(
	args: string[],
	options: ParserOptions<T> = {},
) => createParser(options).parse(args);
