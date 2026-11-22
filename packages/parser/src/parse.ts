import { DEFAULT_DELIMITERS, buildConfigsAndAliases } from "./config";
import { camelCase, resolveValue } from "./helpers";
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
export const KNOWN_FLAG = "known-flag";
export const UNKNOWN_FLAG = "unknown-flag";
export const PARAMETER = "parameter";

type ParseFunction<T extends FlagsDefinition> = (
  args: readonly string[],
) => ParsedResult<InferFlags<T>>;

export type ScanCallback = (arg: string, index: number) => boolean;

export interface ScanResult {
  readonly stoppedAt: number;
}

function recordProvided(provided: string[], key: string): void {
  if (!provided.includes(key)) {
    provided.push(key);
  }
}

function pushSlice(
  target: string[],
  source: readonly string[],
  from: number,
): void {
  for (let k = from; k < source.length; k++) {
    target.push(source[k]);
  }
}

export function createParser<T extends FlagsDefinition>(
  options: ParserOptions<T> = {},
): {
  parse: ParseFunction<T>;
  scan: (args: readonly string[], onPositional: ScanCallback) => ScanResult;
} {
  const delimiters = options.delimiters ?? DEFAULT_DELIMITERS;
  const ignore = options.ignore;
  const { configs, aliases } = buildConfigsAndAliases(
    delimiters,
    options.flags ?? {},
  );

  function resolve(name: string, isShortFlag = false) {
    const dotIdx = name.indexOf(".");
    const rootName = dotIdx === -1 ? name : name.slice(0, dotIdx);

    let key = aliases.get(rootName);
    if (!key) {
      const camel = camelCase(rootName);
      if (camel !== rootName) {
        key = aliases.get(camel);
      }
      if (!key) {
        return undefined;
      }
    }

    const config = configs.get(key)!;

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
    if (
      name.length < 3 ||
      name.charCodeAt(0) !== 110 ||
      name.charCodeAt(1) !== 111
    ) {
      return undefined;
    }
    const third = name.charCodeAt(2);
    const possibleName =
      third === 45
        ? name.slice(3)
        : third >= 65 && third <= 90
          ? String.fromCharCode(third + 32) + name.slice(3)
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

  function shouldProcessAsFlag(arg: string): boolean {
    const len = arg.length;
    if (len < 2 || arg.charCodeAt(0) !== 45) {
      return false;
    }

    const secondChar = arg.charCodeAt(1);
    if (isLetter(secondChar)) {
      return true;
    }
    if (isDigit(secondChar)) {
      return Boolean(resolve(arg[1], true));
    }
    if (secondChar === 45 && len > 2) {
      return isLetter(arg.charCodeAt(2));
    }

    return false;
  }

  const isBooleanLike = (type: unknown): boolean =>
    type === Boolean || isArrayOfType(type, Boolean);

  function isKnownFlag(arg: string): boolean {
    if (arg.charCodeAt(1) === 45) {
      const { rawName } = splitNameAndValue(arg.slice(2), delimiters);

      return Boolean(resolve(rawName, false) ?? resolveNegated(rawName));
    }

    for (let j = 1; j < arg.length; j++) {
      const resolved = resolve(arg[j], true);
      if (!resolved) {
        return false;
      }
      if (!isBooleanLike(resolved.config.type)) {
        return true;
      }
    }

    return true;
  }

  function shouldIgnore(arg: string): boolean {
    if (!ignore) {
      return false;
    }
    const argType = shouldProcessAsFlag(arg)
      ? isKnownFlag(arg)
        ? KNOWN_FLAG
        : UNKNOWN_FLAG
      : PARAMETER;

    return ignore(argType, arg);
  }

  const parse: ParseFunction<T> = (args) => {
    const result: ParsedResult<any> = {
      parameters: [],
      doubleDash: [],
      flags: {},
      raw: args as string[],
      unknown: {},
      rawUnknown: [],
      ignored: [],
      missingRequiredFlags: [],
      provided: [],
    };
    const argsLen = args.length;
    const provided = result.provided;
    let stopped = false;
    let i = 0;

    function takeNextValue(): string {
      if (i + 1 >= argsLen || shouldProcessAsFlag(args[i + 1])) {
        return "";
      }
      if (ignore && shouldIgnore(args[i + 1])) {
        pushSlice(result.ignored, args, i + 1);
        stopped = true;

        return "";
      }

      return args[++i];
    }

    for (; i < argsLen && !stopped; i++) {
      const current = args[i];

      if (current === DOUBLE_DASH) {
        pushSlice(result.doubleDash, args, i + 1);

        break;
      }

      if (ignore && shouldIgnore(current)) {
        pushSlice(result.ignored, args, i);

        break;
      }

      if (!shouldProcessAsFlag(current)) {
        result.parameters.push(current);

        continue;
      }

      if (current.charCodeAt(1) === 45) {
        const { rawName, rawValue, hasSep } = splitNameAndValue(
          current.slice(2),
          delimiters,
        );

        let resolved = resolve(rawName);
        let isNegated = false;

        if (!resolved) {
          const negated = resolveNegated(rawName);
          if (negated) {
            resolved = negated;
            isNegated = true;
          }
        }

        if (!resolved) {
          const key = camelCase(rawName);
          result.rawUnknown.push(current);
          if (hasSep) {
            result.unknown[key] = rawValue!;
          } else {
            const val = takeNextValue();
            if (val) {
              result.rawUnknown.push(val);
            }
            result.unknown[key] = val || true;
          }

          continue;
        }

        const { key, config, path } = resolved;
        recordProvided(provided, key);

        if (path) {
          if (config.type === Object) {
            result.flags[key] ??= {};
            const value = hasSep ? rawValue! : takeNextValue();
            appendDotValues(result.flags[key], path, coerceObjectValue(value));
          }
        } else if (config.type === Boolean) {
          const value = hasSep ? rawValue !== "false" : true;
          result.flags[key] = isNegated ? !value : value;
        } else {
          const value = hasSep ? rawValue! : takeNextValue();
          setValueByType(result.flags, key, value, config);
        }
      } else {
        const chars = current.slice(1);
        const charsLen = chars.length;
        let hasUnknown = false;

        for (let j = 0; j < charsLen; j++) {
          const char = chars[j];
          const resolved = resolve(char, true);

          if (!resolved) {
            result.unknown[char] = true;
            if (!hasUnknown) {
              result.rawUnknown.push(current);
              hasUnknown = true;
            }

            continue;
          }

          const { key, config } = resolved;
          recordProvided(provided, key);

          if (isBooleanLike(config.type)) {
            setValueByType(result.flags, key, "true", config);
          } else if (j + 1 < charsLen) {
            setValueByType(result.flags, key, chars.slice(j + 1), config);

            break;
          } else {
            setValueByType(result.flags, key, takeNextValue(), config);
            if (stopped) {
              break;
            }
          }
        }
      }
    }

    for (const [key, config] of configs.entries()) {
      if (result.flags[key] === undefined) {
        if (config.default !== undefined) {
          result.flags[key] = resolveValue(config.default);
        } else if (config.required) {
          result.missingRequiredFlags.push(key);
        } else {
          result.flags[key] = inferDefault(config.type);
        }
      }
    }

    return result;
  };

  function scan(
    args: readonly string[],
    onPositional: ScanCallback,
  ): ScanResult {
    let i = 0;
    const argsLen = args.length;

    while (i < argsLen) {
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

      let takesNext = false;
      if (current.charCodeAt(1) === 45) {
        const { rawName, hasSep } = splitNameAndValue(
          current.slice(2),
          delimiters,
        );
        const resolved = resolve(rawName) ?? resolveNegated(rawName)!;
        takesNext = !hasSep && !isBooleanLike(resolved.config.type);
      } else {
        for (let j = 1; j < current.length; j++) {
          const resolved = resolve(current[j], true)!;
          if (!isBooleanLike(resolved.config.type)) {
            takesNext = j === current.length - 1;

            break;
          }
        }
      }

      i++;
      if (takesNext && i < argsLen && !shouldProcessAsFlag(args[i])) {
        i++;
      }
    }

    return { stoppedAt: i };
  }

  return { parse, scan };
}

export const parse = <T extends FlagsDefinition>(
  args: readonly string[],
  options: ParserOptions<T> = {},
): ParsedResult<InferFlags<T>> => createParser(options).parse(args);
