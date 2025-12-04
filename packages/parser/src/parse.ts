import { buildConfigsAndAliases, resolveParserOptions } from "./config";
import { iterateArgs } from "./iterator";
import type {
	FlagsDefinition,
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

export function createParser<T extends FlagsDefinition>(
	options: ParserOptions<T> = {},
) {
	const {
		flags: flagsConfig = {},
		delimiters,
		ignore,
	} = resolveParserOptions(options);
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
			ignored: [],
		};

		iterateArgs(
			args,
			result,
			shouldProcessAsFlag,
			ignore,
			(
				// @keep-sorted
				{ check, current, eat, exit, hasNext, index, next },
			) => {
				if (current === DOUBLE_DASH) {
					result.doubleDash.push(...args.slice(index + 1));
					exit(false);

					return;
				}

				if (check(current)) {
					result.ignored.push(current);
					exit();

					return;
				}

				if (!shouldProcessAsFlag(current)) {
					result.parameters.push(current);

					return;
				}

				const isAlias = !current.startsWith(DOUBLE_DASH);
				const chars = current.slice(isAlias ? 1 : 2);

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

						if (
							config.type === Boolean ||
							isArrayOfType(config.type, Boolean)
						) {
							setValueByType(result.flags, key, "true", config);
						} else {
							if (j + 1 < chars.length) {
								// -abval, b's type is not Boolean
								// set b to 'val'
								setValueByType(result.flags, key, chars.slice(j + 1), config);
								j = chars.length;
							} else {
								// -ab foo, we are on "b"
								const next = eat();
								if (next && !shouldProcessAsFlag(next)) {
									setValueByType(result.flags, key, next, config);
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
						const possibleName =
							rawName[2] === "-"
								? rawName.slice(3) // --no-foo -> foo
								: rawName.length > 2 && /[A-Z]/.test(rawName[2])
									? rawName[2].toLowerCase() + rawName.slice(3) // --noFoo -> foo
									: "";

						if (possibleName) {
							const possibleResolved = resolve(possibleName);
							if (
								possibleResolved?.config.type === Boolean &&
								(possibleResolved.config as any).negatable !== false
							) {
								resolved = possibleResolved;
								isNegated = true;
							}
						}
					}
					if (!resolved) {
						const key = toCamelCase(rawName);
						if (hasSep) {
							result.unknown[key] = rawValue!;
						} else if (hasNext && !shouldProcessAsFlag(next)) {
							const value = eat();
							result.unknown[key] = value ?? true;
						} else {
							result.unknown[key] = true;
						}

						return;
					}

					const { key, config, path } = resolved;

					if (path) {
						if (config.type === Object) {
							result.flags[key] ??= {};
							const value = hasSep
								? rawValue!
								: hasNext && !shouldProcessAsFlag(next)
									? (eat() ?? "")
									: "";
							setDotValues(result.flags[key], path, value);
						}
					} else {
						if (config.type === Boolean) {
							const value = hasSep ? rawValue !== "false" : true;
							result.flags[key] = isNegated ? !value : value;
						} else {
							const value = hasSep
								? rawValue!
								: hasNext && !shouldProcessAsFlag(next)
									? (eat() ?? "")
									: "";
							setValueByType(result.flags, key, value, config);
						}
					}
				}
			},
		);

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

export const parse = <T extends FlagsDefinition>(
	args: string[],
	options: ParserOptions<T> = {},
) => createParser(options).parse(args);
