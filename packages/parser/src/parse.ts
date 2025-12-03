import type {
	FlagOptionsValue,
	InferFlags,
	ParsedResult,
	ParserOptions,
} from "./types";
import {
	buildConfigsAndAliases,
	isArrayOfType,
	isFlag,
	setDotValues,
	setValueByType,
	toCamelCase,
} from "./utils";

export function createParser<T extends Record<string, FlagOptionsValue>>(
	options: ParserOptions<T> = {},
) {
	const { flags: flagsConfig = {} as Record<string, FlagOptionsValue> } =
		options;
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

	const isArgFlag = (arg: string) =>
		isFlag(arg) ||
		(arg.startsWith("-") &&
			!arg.startsWith("--") &&
			(resolve(arg.slice(1)) ?? resolve(arg.slice(1, 2))));

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
				// Support both --name=value and --name:value forms. The ':' form
				// is useful when the value itself contains '=' (e.g. --define:K=V).
				const eqIdx = arg.indexOf("=");
				const colonIdx = arg.indexOf(":");
				const sepIdx =
					colonIdx === -1
						? eqIdx
						: eqIdx === -1
							? colonIdx
							: Math.min(colonIdx, eqIdx);
				const hasSep = sepIdx !== -1;
				const rawName = hasSep ? arg.slice(2, sepIdx) : arg.slice(2);
				const val = hasSep ? arg.slice(sepIdx + 1) : undefined;

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
					if (hasSep) {
						result.unknown[key] = val!;
					} else {
						const next = args[i + 1];
						if (next && !isArgFlag(next)) {
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
							? val!
							: args[i + 1] && !isArgFlag(args[i + 1])
								? args[++i]
								: "";
						setDotValues(result.flags[key], path, value);
					}
				} else {
					if (config.type === Boolean) {
						const value = hasSep ? val !== "false" : true;
						result.flags[key] = isNegated ? !value : value;
					} else {
						const next = args[i + 1];
						const value = hasSep
							? val!
							: next && !isArgFlag(next)
								? args[++i]
								: "";
						setValueByType(result.flags, key, value, config);
					}
				}
			}
			// -abcdef
			else if (isArgFlag(arg)) {
				const chars = arg.slice(1);
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
							const next = args[i + 1];
							if (next && !isArgFlag(next)) {
								setValueByType(result.flags, key, args[++i], config);
							}
							// else {
							// 	setValueByType(result.flags, key, "", config);
							// }
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
