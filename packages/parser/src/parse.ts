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

const isBooleanLike = (type: unknown): boolean =>
  type === Boolean || isArrayOfType(type, Boolean);

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
    if (!name.startsWith("no") || name.length < 3) {
      return undefined;
    }
    const third = name[2];
    const possibleName =
      third === "-"
        ? name.slice(3)
        : third >= "A" && third <= "Z"
          ? third.toLowerCase() + name.slice(3)
          : "";

    if (!possibleName) {
      return undefined;
    }

    const resolved = resolve(possibleName);
    if (
      resolved?.config.type === Boolean &&
      (resolved.config as { negatable?: boolean }).negatable !== false
    ) {
      return resolved;
    }
  }

  function shouldProcessAsFlag(arg: string): boolean {
    if (arg.length < 2 || arg[0] !== "-") {
      return false;
    }

    const secondChar = arg.charCodeAt(1);
    if (isLetter(secondChar)) {
      return true;
    }
    if (isDigit(secondChar)) {
      return Boolean(resolve(arg[1], true));
    }
    if (arg[1] === "-" && arg.length > 2) {
      return isLetter(arg.charCodeAt(2));
    }

    return false;
  }

  /**
   * Inspects a flag token once: returns `undefined` if unknown, `true` if it
   * expects its value in the next argv token, or `false` if self-contained.
   */
  function inspectFlag(arg: string): boolean | undefined {
    if (arg[1] === "-") {
      const { rawName, hasSep } = splitNameAndValue(arg.slice(2), delimiters);
      const resolved = resolve(rawName, false) ?? resolveNegated(rawName);
      if (!resolved) {
        return undefined;
      }

      return !hasSep && !isBooleanLike(resolved.config.type);
    }

    for (let j = 1; j < arg.length; j++) {
      const resolved = resolve(arg[j], true);
      if (!resolved) {
        return undefined;
      }
      if (!isBooleanLike(resolved.config.type)) {
        return j === arg.length - 1;
      }
    }

    return false;
  }

  function shouldIgnore(arg: string): boolean {
    if (!ignore) {
      return false;
    }
    const argType = shouldProcessAsFlag(arg)
      ? inspectFlag(arg) === undefined
        ? UNKNOWN_FLAG
        : KNOWN_FLAG
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

    function parseLongFlag(current: string): void {
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

        return;
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
    }

    function parseShortFlags(current: string): void {
      const chars = current.slice(1);
      let hasUnknown = false;

      for (let j = 0; j < chars.length; j++) {
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
        } else if (j + 1 < chars.length) {
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

    for (; i < argsLen; i++) {
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
      } else if (current[1] === "-") {
        parseLongFlag(current);
      } else {
        parseShortFlags(current);
      }

      if (stopped) {
        break;
      }
    }

    for (const [key, config] of configs) {
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

      const takesNext = inspectFlag(current);
      if (takesNext === undefined) {
        return { stoppedAt: i };
      }

      i++;
      if (takesNext && i < args.length && !shouldProcessAsFlag(args[i])) {
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
