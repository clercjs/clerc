import type {
	FlagOptions,
	FlagOptionsValue,
	InferFlags,
	ParsedResult,
	ParserOptions,
} from "./types";
import { isFlag, setDotValues, setValueByType, toCamelCase } from "./utils";

const normalizeConfig = (config: FlagOptionsValue): FlagOptions =>
	typeof config === "function" || Array.isArray(config)
		? { type: config }
		: config;

export function createParser<T extends Record<string, FlagOptionsValue>>(
	options: ParserOptions<T> = {},
) {
	const { flags: flagsConfig = {} as Record<string, FlagOptionsValue> } =
		options;
	const configs = new Map<string, FlagOptions>();
	const aliases = new Map<string, string>();

	for (const [name, config] of Object.entries(flagsConfig)) {
		const normalized = normalizeConfig(config);
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
			if (arg === "--") {
				result.doubleDash.push(...args.slice(i + 1));
				break;
			}

			if (arg.startsWith("--")) {
				const eqIdx = arg.indexOf("=");
				const hasEq = eqIdx !== -1;
				const rawName = hasEq ? arg.slice(2, eqIdx) : arg.slice(2);
				const val = hasEq ? arg.slice(eqIdx + 1) : undefined;

				let resolved = resolve(rawName);
				let isNegated = false;

				if (!resolved) {
					let positiveName = "";
					if (rawName.startsWith("no-")) {
						positiveName = rawName.slice(3);
					} else if (
						rawName.startsWith("no") &&
						rawName.length > 2 &&
						/[A-Z]/.test(rawName[2])
					) {
						positiveName = rawName[2].toLowerCase() + rawName.slice(3);
					}

					if (positiveName) {
						const res = resolve(positiveName);
						if (
							res?.config.type === Boolean &&
							(res.config as any).negatable !== false
						) {
							resolved = res;
							isNegated = true;
						}
					}
				}

				if (!resolved) {
					const key = toCamelCase(rawName);
					if (hasEq) {
						result.unknown[key] = val!;
					} else {
						const next = args[i + 1];
						if (next && !isFlag(next)) {
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
						const value = hasEq
							? val!
							: args[i + 1] && !isFlag(args[i + 1])
								? args[++i]
								: "";
						setDotValues(result.flags[key], path, value);
					} else {
						result.unknown[rawName] = hasEq ? val! : true;
					}
				} else {
					if (config.type === Boolean) {
						const value = hasEq ? val !== "false" : true;
						result.flags[key] = isNegated ? !value : value;
					} else {
						const next = args[i + 1];
						const value = hasEq ? val! : next && !isFlag(next) ? args[++i] : "";
						setValueByType(result.flags, key, value, config);
					}
				}
			}
			// -abcdef
			else if (isFlag(arg)) {
				const chars = arg.slice(1);
				for (let j = 0; j < chars.length; j++) {
					const char = chars[j];
					const resolved = resolve(char);

					if (!resolved) {
						result.unknown[char] = true;
						continue;
					}

					const { key, config } = resolved;
					if (config.type === Boolean) {
						result.flags[key] = true;
					} else {
						if (j + 1 < chars.length) {
							// -abval, b's type is not Boolean
							// set b to 'val'
							setValueByType(result.flags, key, chars.slice(j + 1), config);
							j = chars.length;
						} else {
							const next = args[i + 1];
							if (next && !isFlag(next)) {
								setValueByType(result.flags, key, args[++i], config);
							} else {
								setValueByType(result.flags, key, "", config);
							}
						}
					}
				}
			} else {
				result.parameters.push(arg);
			}
		}

		// Apply defaults
		for (const [key, config] of configs.entries()) {
			const val = result.flags[key];
			if (val === undefined) {
				if (config.default !== undefined) {
					result.flags[key] = config.default;
				}
				// Make sure arrays and objects are always initialized with default values
				else if (Array.isArray(config.type)) {
					result.flags[key] = [];
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
