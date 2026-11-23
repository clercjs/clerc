import { InvalidSchemaError } from "./errors";
import type { FlagKind } from "./schema";
import { camelCase, kebabCase } from "./utils";

export const DOUBLE_DASH = "--";

export type RawInputType = string | boolean;

export interface InvalidFlagValue {
  readonly flag: string;
  readonly value: string;
  readonly message: string;
}

export interface LexFlagSpec {
  readonly key: string;
  readonly kind: FlagKind;
  readonly short?: string;
  readonly negatable?: boolean;
}

export interface LexParserOptions {
  readonly stopAtFirstPositional?: boolean;
}

export interface LexParseResult {
  readonly parameters: string[];
  readonly doubleDash: string[];
  readonly flags: Record<string, string | string[] | boolean | number>;
  readonly unknown: Record<string, RawInputType>;
  readonly provided: string[];
  readonly missingValueFlags: string[];
  readonly invalidValues: InvalidFlagValue[];
}

export type ScanCallback = (arg: string, index: number) => boolean;

export interface ScanResult {
  readonly stoppedAt: number;
}

export interface LexParser {
  readonly parse: (args: readonly string[]) => LexParseResult;
  readonly scan: (
    args: readonly string[],
    onPositional: ScanCallback,
  ) => ScanResult;
}

interface CompiledLexFlag {
  readonly key: string;
  readonly kind: FlagKind;
  readonly short?: string;
  readonly negatable: boolean;
}

const INVALID_BOOL_MSG = "expected a boolean ('true' or 'false')";

const isLetter = (c: number): boolean =>
  (c >= 65 && c <= 90) || (c >= 97 && c <= 122);

const isDigit = (c: number): boolean => c >= 48 && c <= 57;

const hasReservedChar = (name: string): boolean =>
  name.includes(" ") || name.includes("=");

export function parseBooleanLiteral(raw: string): boolean | undefined {
  const lower = raw.toLowerCase();
  if (lower === "true" || lower === "1") {
    return true;
  }
  if (lower === "false" || lower === "0") {
    return false;
  }

  return undefined;
}

function recordUnique(list: string[], key: string): void {
  if (!list.includes(key)) {
    list.push(key);
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

function splitLongOption(raw: string): {
  readonly name: string;
  readonly value: string | undefined;
} {
  const eq = raw.indexOf("=");

  return eq === -1
    ? { name: raw, value: undefined }
    : { name: raw.slice(0, eq), value: raw.slice(eq + 1) };
}

function registerAlias(
  map: Map<string, CompiledLexFlag>,
  alias: string,
  flag: CompiledLexFlag,
  label: string,
): void {
  const existing = map.get(alias);
  if (existing && existing.key !== flag.key) {
    throw new InvalidSchemaError(
      `Flag "${flag.key}" ${label} "${alias}" conflicts with flag "${existing.key}".`,
    );
  }
  map.set(alias, flag);
}

function buildFlagLookup(specs: Iterable<LexFlagSpec>): {
  readonly byName: ReadonlyMap<string, CompiledLexFlag>;
  readonly byShort: ReadonlyMap<string, CompiledLexFlag>;
} {
  const byName = new Map<string, CompiledLexFlag>();
  const byShort = new Map<string, CompiledLexFlag>();

  for (const spec of specs) {
    if (spec.key.length < 2) {
      throw new InvalidSchemaError(
        `Flag "${spec.key}" name must be at least 2 characters long.`,
      );
    }
    if (spec.short !== undefined && spec.short.length !== 1) {
      throw new InvalidSchemaError(
        `Flag "${spec.key}" short flag must be exactly 1 character long.`,
      );
    }
    if (
      hasReservedChar(spec.key) ||
      (spec.short !== undefined && hasReservedChar(spec.short))
    ) {
      throw new InvalidSchemaError(
        `Flag "${spec.key}" contains reserved characters.`,
      );
    }

    const compiled: CompiledLexFlag = {
      key: spec.key,
      kind: spec.kind,
      short: spec.short,
      negatable: spec.kind === "boolean" && spec.negatable !== false,
    };

    registerAlias(byName, spec.key, compiled, "name");
    const camel = camelCase(spec.key);
    if (camel !== spec.key) {
      registerAlias(byName, camel, compiled, "alias");
    }
    const kebab = kebabCase(spec.key);
    if (kebab !== spec.key) {
      registerAlias(byName, kebab, compiled, "alias");
    }
    if (compiled.short) {
      registerAlias(byShort, compiled.short, compiled, "short alias");
    }
  }

  return { byName, byShort };
}

function appendRawValue(
  flags: Record<string, string | string[] | boolean | number>,
  flag: CompiledLexFlag,
  raw: string,
): void {
  if (flag.kind === "array") {
    const list = (flags[flag.key] as string[] | undefined) ?? [];
    list.push(raw);
    flags[flag.key] = list;
  } else {
    flags[flag.key] = raw;
  }
}

export function createLexParser(
  specs: Iterable<LexFlagSpec>,
  options: LexParserOptions = {},
): LexParser {
  const stopAtFirstPositional = Boolean(options.stopAtFirstPositional);
  const { byName, byShort } = buildFlagLookup(specs);

  function resolveLong(
    name: string,
  ): { readonly flag: CompiledLexFlag; readonly negated: boolean } | undefined {
    const direct = byName.get(name);
    if (direct) {
      return { flag: direct, negated: false };
    }
    if (name.startsWith("no-")) {
      const target = byName.get(name.slice(3));
      if (target?.negatable) {
        return { flag: target, negated: true };
      }
    }

    return undefined;
  }

  function isFlagToken(arg: string): boolean {
    if (arg.length < 2 || arg[0] !== "-") {
      return false;
    }
    const second = arg.charCodeAt(1);
    if (isLetter(second)) {
      return true;
    }
    if (isDigit(second)) {
      return byShort.has(arg[1]);
    }

    return arg[1] === "-" && arg.length > 2 && isLetter(arg.charCodeAt(2));
  }

  function inspectFlag(arg: string): boolean | undefined {
    if (arg[1] === "-") {
      const { name, value } = splitLongOption(arg.slice(2));
      const resolved = resolveLong(name);
      if (!resolved) {
        return undefined;
      }

      return (
        value === undefined &&
        resolved.flag.kind !== "boolean" &&
        resolved.flag.kind !== "counter"
      );
    }

    for (let j = 1; j < arg.length; j++) {
      const flag = byShort.get(arg[j]);
      if (!flag) {
        return undefined;
      }
      if (flag.kind !== "boolean" && flag.kind !== "counter") {
        return j === arg.length - 1;
      }
    }

    return false;
  }

  function parse(args: readonly string[]): LexParseResult {
    const flags: Record<string, string | string[] | boolean | number> = {};
    const parameters: string[] = [];
    const doubleDash: string[] = [];
    const unknown: Record<string, RawInputType> = {};
    const provided: string[] = [];
    const missingValueFlags: string[] = [];
    const invalidValues: InvalidFlagValue[] = [];

    const len = args.length;
    let i = 0;

    function takeNextValue(): string | undefined {
      if (i + 1 >= len) {
        return undefined;
      }
      const next = args[i + 1];
      if (next === DOUBLE_DASH || isFlagToken(next)) {
        return undefined;
      }

      return args[++i];
    }

    function parseLongFlag(current: string): void {
      const { name, value } = splitLongOption(current.slice(2));
      const resolved = resolveLong(name);
      if (!resolved) {
        unknown[camelCase(name)] = value ?? true;

        return;
      }

      const { flag, negated } = resolved;

      switch (flag.kind) {
        case "boolean": {
          if (value === undefined) {
            recordUnique(provided, flag.key);
            flags[flag.key] = !negated;

            return;
          }
          const parsedBool = parseBooleanLiteral(value);
          if (parsedBool === undefined) {
            invalidValues.push({
              flag: flag.key,
              value,
              message: INVALID_BOOL_MSG,
            });

            return;
          }
          recordUnique(provided, flag.key);
          flags[flag.key] = negated ? !parsedBool : parsedBool;

          return;
        }
        case "counter": {
          if (value === undefined) {
            recordUnique(provided, flag.key);
            flags[flag.key] =
              ((flags[flag.key] as number | undefined) ?? 0) + 1;

            return;
          }
          const parsedBool = parseBooleanLiteral(value);
          if (parsedBool === undefined) {
            invalidValues.push({
              flag: flag.key,
              value,
              message: INVALID_BOOL_MSG,
            });

            return;
          }
          recordUnique(provided, flag.key);
          if (parsedBool) {
            flags[flag.key] =
              ((flags[flag.key] as number | undefined) ?? 0) + 1;
          }

          return;
        }
        case "single":
        case "array": {
          const val = value ?? takeNextValue();
          if (val === undefined) {
            recordUnique(missingValueFlags, flag.key);

            return;
          }
          recordUnique(provided, flag.key);
          appendRawValue(flags, flag, val);
        }
      }
    }

    function parseShortFlags(current: string): void {
      const chars = current.slice(1);
      for (let j = 0; j < chars.length; j++) {
        const char = chars[j];
        const flag = byShort.get(char);
        if (!flag) {
          unknown[char] = true;

          continue;
        }

        if (flag.kind === "boolean") {
          recordUnique(provided, flag.key);
          flags[flag.key] = true;
        } else if (flag.kind === "counter") {
          recordUnique(provided, flag.key);
          flags[flag.key] = ((flags[flag.key] as number | undefined) ?? 0) + 1;
        } else if (j + 1 < chars.length) {
          recordUnique(provided, flag.key);
          const rest = chars.slice(j + 1);
          appendRawValue(
            flags,
            flag,
            rest.startsWith("=") ? rest.slice(1) : rest,
          );

          break;
        } else {
          const val = takeNextValue();
          if (val === undefined) {
            recordUnique(missingValueFlags, flag.key);
          } else {
            recordUnique(provided, flag.key);
            appendRawValue(flags, flag, val);
          }
        }
      }
    }

    for (; i < len; i++) {
      const current = args[i];
      if (current === DOUBLE_DASH) {
        pushSlice(doubleDash, args, i + 1);

        break;
      }

      if (!isFlagToken(current)) {
        if (stopAtFirstPositional) {
          pushSlice(parameters, args, i);

          break;
        }
        parameters.push(current);
      } else if (current[1] === "-") {
        parseLongFlag(current);
      } else {
        parseShortFlags(current);
      }
    }

    return {
      parameters,
      doubleDash,
      flags,
      unknown,
      provided,
      missingValueFlags,
      invalidValues,
    };
  }

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

      if (!isFlagToken(current)) {
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
      if (
        takesNext &&
        i < args.length &&
        args[i] !== DOUBLE_DASH &&
        !isFlagToken(args[i])
      ) {
        i++;
      }
    }

    return { stoppedAt: i };
  }

  return { parse, scan };
}
