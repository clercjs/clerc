import { buildConfigsAndAliases, resolveParserOptions } from "./config";
import { camelCase, resolveValue } from "./helpers";
import { iterateArgs } from "./iterator";
import type {
  FlagsDefinition,
  InferFlags,
  ParsedResult,
  ParserOptions,
} from "./types";
import {
  appendDotValues,
  coerceObjectValue,
  inferDefault,
  isArrayOfType,
  isDigit,
  isLetter,
  setValueByType,
  splitNameAndValue,
} from "./utils";

export const DOUBLE_DASH = "--";

type ParseFunction<T extends FlagsDefinition> = (
  args: string[],
) => ParsedResult<InferFlags<T>>;

export type ScanCallback = (arg: string, index: number) => boolean;

export interface ScanResult {
  readonly stoppedAt: number;
}

export function createParser<T extends FlagsDefinition>(
  options: ParserOptions<T> = {},
): {
  parse: ParseFunction<T>;
  scan: (args: readonly string[], onPositional: ScanCallback) => ScanResult;
} {
  const {
    flags: flagsConfig = {},
    delimiters,
    ignore,
  } = resolveParserOptions(options);
  const { configs, aliases } = buildConfigsAndAliases(delimiters, flagsConfig);

  function resolve(name: string, isShortFlag = false) {
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

    // Don't resolve short aliases when processing long flags (--h should not match short: 'h')
    if (!isShortFlag && config.short === rootName) {
      return undefined;
    }

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
        : name.length > 2 &&
            name.charCodeAt(2) >= 65 &&
            name.charCodeAt(2) <= 90 // Check if uppercase letter (A-Z)
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
      const isShortFlag = secondChar !== 45; // not '--'
      const name = isShortFlag ? arg[1] : arg.slice(2);

      return !!resolve(name, isShortFlag);
    }

    // Check for double dash
    if (secondChar === 45 && len > 2) {
      const thirdChar = arg.charCodeAt(2);

      return isLetter(thirdChar);
    }

    return false;
  }

  const isBooleanLike = (type: unknown): boolean =>
    type === Boolean || isArrayOfType(type, Boolean);

  function isKnownFlag(arg: string) {
    const secondChar = arg.charCodeAt(1);

    if (secondChar === 45) {
      const { rawName } = splitNameAndValue(arg.slice(2), delimiters);
      if (resolve(rawName, false)) {
        return true;
      }
      if (resolveNegated(rawName)) {
        return true;
      }

      return false;
    }

    const chars = arg.slice(1);
    for (const char of chars) {
      const resolved = resolve(char, true);
      if (!resolved) {
        return false;
      }
      if (!isBooleanLike(resolved.config.type)) {
        return true;
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
      rawUnknown: [],
      ignored: [],
      missingRequiredFlags: [],
      provided: [],
    };
    const providedSet = new Set<string>();

    iterateArgs(
      args,
      result,
      shouldProcessAsFlag,
      isKnownFlag,
      ignore,
      (
        // @keep-sorted
        {
          advance,
          advanceUnknown,
          current,
          exit,
          hasNext,
          index,
          markUnknown,
          next,
          shouldIgnore,
        },
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

        const isShortFlag = !current.startsWith(DOUBLE_DASH);
        const chars = current.slice(isShortFlag ? 1 : 2);

        // -abc
        if (isShortFlag) {
          const charsLen = chars.length;
          let hasUnknown = false;
          for (let j = 0; j < charsLen; j++) {
            const char = chars[j];
            const resolved = resolve(char, true);

            if (!resolved) {
              result.unknown[char] = true;
              if (!hasUnknown) {
                markUnknown();
                hasUnknown = true;
              }

              continue;
            }

            const { key, config } = resolved;
            providedSet.add(key);
            const configType = config.type;

            if (isBooleanLike(configType)) {
              setValueByType(result.flags, key, "true", config);
            } else {
              if (j + 1 < charsLen) {
                // -abval, b's type is not Boolean
                // set b to 'val'
                setValueByType(result.flags, key, chars.slice(j + 1), config);

                break;
              } else {
                // -ab foo, we are on "b"
                const value =
                  hasNext && !shouldProcessAsFlag(next) ? advance() : "";
                setValueByType(result.flags, key, value, config);
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
            markUnknown();
            if (hasSep) {
              result.unknown[key] = rawValue!;
            } else if (hasNext && !shouldProcessAsFlag(next)) {
              const value = advanceUnknown();
              result.unknown[key] = value || true;
            } else {
              result.unknown[key] = true;
            }

            return;
          }

          const { key, config, path } = resolved;
          providedSet.add(key);

          if (path) {
            if (config.type === Object) {
              result.flags[key] ??= {};
              const value = hasSep
                ? rawValue!
                : hasNext && !shouldProcessAsFlag(next)
                  ? advance()
                  : "";
              appendDotValues(
                result.flags[key],
                path,
                coerceObjectValue(value),
              );
            }
          } else {
            if (config.type === Boolean) {
              const value = hasSep ? rawValue !== "false" : true;
              result.flags[key] = isNegated ? !value : value;
            } else {
              const value = hasSep
                ? rawValue!
                : hasNext && !shouldProcessAsFlag(next)
                  ? advance()
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
        } else if (config.required) {
          result.missingRequiredFlags.push(key);
        } else {
          result.flags[key] = inferDefault(config.type);
        }
      }
    }

    result.provided = [...providedSet];

    return result;
  };

  function scan(
    args: readonly string[],
    onPositional: ScanCallback,
  ): ScanResult {
    let i = 0;

    while (i < args.length) {
      const current = args[i];

      if (current === DOUBLE_DASH) {
        return { stoppedAt: i };
      }

      if (!shouldProcessAsFlag(current)) {
        if (!onPositional(current, i)) {
          return { stoppedAt: i };
        }
        i++;

        continue;
      }

      if (!isKnownFlag(current)) {
        return { stoppedAt: i };
      }

      const isShortFlag = !current.startsWith(DOUBLE_DASH);
      if (isShortFlag) {
        const chars = current.slice(1);
        let takesNext = false;
        for (let j = 0; j < chars.length; j++) {
          const resolved = resolve(chars[j], true)!;
          if (!isBooleanLike(resolved.config.type)) {
            takesNext = j === chars.length - 1;

            break;
          }
        }
        i++;
        if (takesNext && i < args.length && !shouldProcessAsFlag(args[i])) {
          i++;
        }
      } else {
        const { rawName, hasSep } = splitNameAndValue(
          current.slice(2),
          delimiters,
        );
        const resolved = resolve(rawName) ?? resolveNegated(rawName)!;
        const takesNext = !hasSep && !isBooleanLike(resolved.config.type);
        i++;
        if (takesNext && i < args.length && !shouldProcessAsFlag(args[i])) {
          i++;
        }
      }
    }

    return { stoppedAt: i };
  }

  return { parse, scan };
}

export const parse = <T extends FlagsDefinition>(
  args: string[],
  options: ParserOptions<T> = {},
): ParsedResult<InferFlags<T>> => createParser(options).parse(args);
