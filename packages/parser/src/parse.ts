import { camelCase, resolveValue } from "@clerc/utils";

import { buildConfigsAndAliases, resolveParserOptions } from "./config";
import { MissingRequiredFlagError } from "./errors";
import { iterateArgs } from "./iterator";
import type {
	FlagsDefinition,
	InferFlags,
	ParsedResult,
	ParserOptions,
} from "./types";
import {
	isArrayOfType,
	isDigit,
	isLetter,
	setDotValues,
	setValueByType,
	splitNameAndValue,
} from "./utils";

export const DOUBLE_DASH = "--";

type ParseFunction<T extends FlagsDefinition> = (
	args: string[],
) => ParsedResult<InferFlags<T>>;

export function createParser<T extends FlagsDefinition>(
	options: ParserOptions<T> = {},
): { parse: ParseFunction<T> } {
	const {
		flags: flagsConfig = {},
		delimiters,
		ignore,
	} = resolveParserOptions(options);
	const { configs, aliases } = buildConfigsAndAliases(delimiters, flagsConfig);

	function resolve(name: string) {
		const dotIdx = name.indexOf(".");
		const rootName = dotIdx === -1 ? name : name.slice(0, dotIdx);

		let key = aliases.get(rootName);
		if (!key) {
			key = aliases.get(camelCase(rootName));
			if (!key) {
				return undefined;
			}
		}

		const config = configs.get(key)!;

		return {
			key,
			config,
			path: dotIdx === -1 ? undefined : name.slice(dotIdx + 1),
		};
	}

	function resolveNegated(name: string) {
		if (!name.startsWith("no")) {
			return undefined;
		}
		const possibleName =
			name[2] === "-"
				? name.slice(3) // --no-foo -> foo
				: name.length > 2 && /[A-Z]/.test(name[2])
					? name[2].toLowerCase() + name.slice(3) // --noFoo -> foo
					: "";

		if (possibleName) {
			const possibleResolved = resolve(possibleName);
			if (
				possibleResolved?.config.type === Boolean &&
				(possibleResolved.config as any).negatable !== false
			) {
				return possibleResolved;
			}
		}
	}

	function shouldProcessAsFlag(arg: string) {
		// Check first character for quick rejection (45 is '-')
		const firstChar = arg.charCodeAt(0);
		if (firstChar !== 45) {
			return false;
		}

		const len = arg.length;
		if (len < 2) {
			return false;
		}

		const secondChar = arg.charCodeAt(1);

		// Check if it's a letter
		if (isLetter(secondChar)) {
			return true;
		}

		// Check if it's a digit
		if (isDigit(secondChar)) {
			const isAlias = secondChar !== 45; // not '--'
			const name = isAlias ? arg[1] : arg.slice(2);

			return !!resolve(name);
		}

		// Check for double dash
		if (secondChar === 45 && len > 2) {
			const thirdChar = arg.charCodeAt(2);

			return isLetter(thirdChar);
		}

		return false;
	}

	function isKnownFlag(arg: string) {
		const secondChar = arg.charCodeAt(1);

		if (secondChar === 45) {
			const { rawName } = splitNameAndValue(arg.slice(2), delimiters);
			if (resolve(rawName)) {
				return true;
			}
			if (resolveNegated(rawName)) {
				return true;
			}

			return false;
		}

		if (isDigit(secondChar)) {
			return true;
		}

		const chars = arg.slice(1);
		for (const char of chars) {
			if (!resolve(char)) {
				return false;
			}
		}

		return true;
	}

	const parse: ParseFunction<T> = (args) => {
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
			isKnownFlag,
			ignore,
			(
				// @keep-sorted
				{ current, eat, exit, hasNext, index, next, shouldIgnore },
			) => {
				if (current === DOUBLE_DASH) {
					result.doubleDash.push(...args.slice(index + 1));
					exit(false);

					return;
				}

				if (shouldIgnore(current)) {
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
					const charsLen = chars.length;
					for (let j = 0; j < charsLen; j++) {
						const char = chars[j];
						const resolved = resolve(char);

						if (!resolved) {
							result.unknown[char] = true;
							continue;
						}

						const { key, config } = resolved;
						const configType = config.type;

						if (configType === Boolean || isArrayOfType(configType, Boolean)) {
							setValueByType(result.flags, key, "true", config);
						} else {
							if (j + 1 < charsLen) {
								// -abval, b's type is not Boolean
								// set b to 'val'
								setValueByType(result.flags, key, chars.slice(j + 1), config);
								break;
							} else {
								// -ab foo, we are on "b"
								const nextValue = eat();
								if (nextValue && !shouldProcessAsFlag(nextValue)) {
									setValueByType(result.flags, key, nextValue, config);
								}
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
					if (!resolved) {
						const negated = resolveNegated(rawName);
						if (negated) {
							resolved = negated;
							isNegated = true;
						}
					}
					if (!resolved) {
						const key = camelCase(rawName);
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
					result.flags[key] = resolveValue(config.default);
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
				} else if (config.required) {
					throw new MissingRequiredFlagError(key);
				}
			}
		}

		return result;
	};

	return { parse };
}

export const parse = <T extends FlagsDefinition>(
	args: string[],
	options: ParserOptions<T> = {},
): ParsedResult<InferFlags<T>> => createParser(options).parse(args);
