import { InvalidSchemaError } from "./errors";
import type { FlagKind } from "./schema";
import { camelCase, kebabCase } from "./utils";

export const DOUBLE_DASH = "--";
export const IMPLICIT_FLAG_VALUE = Symbol("clerc.implicitFlagValue");
export const INVALID_BOOL_MSG = "expected a boolean ('true' or 'false')";

export type RawInputType = string | boolean;

export interface InvalidFlagValue {
  readonly flag: string;
  readonly value: string;
  readonly message: string;
}

export interface ArgvFlagSpec {
  readonly key: string;
  readonly kind: FlagKind;
  readonly short?: string;
  readonly aliases?: readonly string[];
  readonly negatable?: boolean;
  readonly optionalValue?: boolean;
}

export type StopParsingTokenKind = "known-flag" | "unknown-flag" | "positional";

export interface StopParsingToken {
  readonly kind: StopParsingTokenKind;
  readonly raw: string;
  readonly index: number;
  readonly positionalCount: number;
}

export type StopParsingPredicate = (token: StopParsingToken) => boolean;

export type StopParsingOption =
  "first-positional" | "unknown-flag" | StopParsingPredicate;

export interface ArgvParserOptions {
  readonly stopParsing?: StopParsingOption;
}

export type FlagValues = Record<
  string,
  string | string[] | boolean | number | typeof IMPLICIT_FLAG_VALUE
>;

export interface ArgvParseResult {
  readonly positionals: readonly string[];
  readonly doubleDash: readonly string[];
  readonly hasDoubleDash: boolean;
  readonly stoppedEarly: boolean;
  readonly flags: FlagValues;
  readonly unknown: Readonly<Record<string, RawInputType>>;
  readonly provided: readonly string[];
  readonly missingValueFlags: readonly string[];
  readonly missingValueCandidates: Readonly<Record<string, string>>;
  readonly trailingMissingValueFlag?: string;
  readonly invalidValues: readonly InvalidFlagValue[];
}

export type ScanCallback = (arg: string, index: number) => boolean;

export interface ScanResult {
  readonly stoppedAt: number;
}

export interface ArgvParser {
  readonly parse: (args: readonly string[]) => ArgvParseResult;
  readonly scan: (
    args: readonly string[],
    onPositional: ScanCallback,
    startIndex?: number,
  ) => ScanResult;
}

interface CompiledFlag {
  readonly key: string;
  readonly kind: FlagKind;
  readonly negatable: boolean;
  readonly optionalValue: boolean;
}

interface LookupTables {
  readonly byName: Record<string, CompiledFlag>;
  readonly byShortCode: (CompiledFlag | undefined)[] | undefined;
  readonly byShortExtra: Record<string, CompiledFlag> | undefined;
  readonly hasDigitShort: boolean;
}

const CHAR_DASH = 45; // '-'
const CHAR_EQ = 61; // '='
const CHAR_N = 110; // 'n'
const CHAR_O = 111; // 'o'

const EMPTY_STRINGS: readonly string[] = Object.freeze([]);
const EMPTY_INVALID: readonly InvalidFlagValue[] = Object.freeze([]);
const EMPTY_UNKNOWN: Readonly<Record<string, RawInputType>> = Object.freeze({});
const EMPTY_CANDIDATES: Readonly<Record<string, string>> = Object.freeze({});

const isLetter = (c: number): boolean =>
  (c >= 65 && c <= 90) || (c >= 97 && c <= 122);

const isDigit = (c: number): boolean => c >= 48 && c <= 57;

const isValueKind = (kind: FlagKind): boolean =>
  kind === "single" || kind === "array";

const hasReservedChar = (name: string): boolean =>
  name.includes(" ") || name.includes("=");

const hasNoPrefix = (name: string): boolean =>
  name.length > 3 &&
  name.charCodeAt(0) === CHAR_N &&
  name.charCodeAt(1) === CHAR_O &&
  name.charCodeAt(2) === CHAR_DASH;

export function parseBooleanLiteral(raw: string): boolean | undefined {
  if (raw === "true" || raw === "1") {
    return true;
  }
  if (raw === "false" || raw === "0") {
    return false;
  }
  const lower = raw.toLowerCase();

  return lower === "true" ? true : lower === "false" ? false : undefined;
}

function registerAlias(
  table: Record<string, CompiledFlag>,
  alias: string,
  entry: CompiledFlag,
  label: string,
): void {
  const existing = table[alias];
  if (existing && existing.key !== entry.key) {
    throw new InvalidSchemaError(
      `Flag "${entry.key}" ${label} "${alias}" conflicts with flag "${existing.key}".`,
    );
  }
  table[alias] = entry;
}

function registerNameVariants(
  table: Record<string, CompiledFlag>,
  name: string,
  entry: CompiledFlag,
  primaryLabel: string,
): void {
  registerAlias(table, name, entry, primaryLabel);
  const camel = camelCase(name);
  if (camel !== name) {
    registerAlias(table, camel, entry, "alias");
  }
  const kebab = kebabCase(name);
  if (kebab !== name) {
    registerAlias(table, kebab, entry, "alias");
  }
}

function buildLookupTables(specs: Iterable<ArgvFlagSpec>): LookupTables {
  const byName: Record<string, CompiledFlag> = Object.create(null);
  let byShortCode: (CompiledFlag | undefined)[] | undefined;
  let byShortExtra: Record<string, CompiledFlag> | undefined;
  let hasDigitShort = false;

  for (const spec of specs) {
    const { key, kind, short } = spec;
    if (key.length < 2) {
      throw new InvalidSchemaError(
        `Flag "${key}" name must be at least 2 characters long.`,
      );
    }
    if (short !== undefined && short.length !== 1) {
      throw new InvalidSchemaError(
        `Flag "${key}" short flag must be exactly 1 character long.`,
      );
    }
    if (
      hasReservedChar(key) ||
      (short !== undefined && hasReservedChar(short))
    ) {
      throw new InvalidSchemaError(
        `Flag "${key}" contains reserved characters.`,
      );
    }

    const entry: CompiledFlag = {
      key,
      kind,
      negatable: kind === "boolean" && spec.negatable !== false,
      optionalValue: kind === "single" && Boolean(spec.optionalValue),
    };

    registerNameVariants(byName, key, entry, "name");

    if (spec.aliases) {
      for (const alias of spec.aliases) {
        if (alias.length < 2) {
          throw new InvalidSchemaError(
            `Flag "${key}" alias "${alias}" must be at least 2 characters long.`,
          );
        }
        if (hasReservedChar(alias)) {
          throw new InvalidSchemaError(
            `Flag "${key}" alias "${alias}" contains reserved characters.`,
          );
        }
        registerNameVariants(byName, alias, entry, "alias");
      }
    }

    if (short !== undefined) {
      const code = short.charCodeAt(0);
      if (isDigit(code)) {
        hasDigitShort = true;
      }
      if (code < 128) {
        // eslint-disable-next-line unicorn/no-new-array -- Fixed-size ASCII lookup table avoids Array.from iterator overhead
        byShortCode ??= new Array<CompiledFlag | undefined>(128);
        const existing = byShortCode[code];
        if (existing && existing.key !== key) {
          throw new InvalidSchemaError(
            `Flag "${key}" short alias "${short}" conflicts with flag "${existing.key}".`,
          );
        }
        byShortCode[code] = entry;
      } else {
        byShortExtra ??= Object.create(null);
        registerAlias(byShortExtra!, short, entry, "short alias");
      }
    }
  }

  return { byName, byShortCode, byShortExtra, hasDigitShort };
}

export function createArgvParser(
  specs: Iterable<ArgvFlagSpec>,
  options: ArgvParserOptions = {},
): ArgvParser {
  const { stopParsing } = options;
  const stopAtFirstPositional = stopParsing === "first-positional";
  const stopAtUnknownFlag = stopParsing === "unknown-flag";
  const stopPredicate =
    typeof stopParsing === "function" ? stopParsing : undefined;
  const { byName, byShortCode, byShortExtra, hasDigitShort } =
    buildLookupTables(specs);

  function isKnownShortToken(token: string): boolean {
    for (let j = 1; j < token.length; j++) {
      const code = token.charCodeAt(j);
      const flag = code < 128 ? byShortCode?.[code] : byShortExtra?.[token[j]];
      if (flag === undefined) {
        return false;
      }
      if (isValueKind(flag.kind)) {
        return true;
      }
    }

    return true;
  }

  const isShortStart = (code: number): boolean =>
    isLetter(code) ||
    (hasDigitShort && isDigit(code) && byShortCode![code] !== undefined);

  function resolveLongFlag(
    name: string,
  ): { readonly flag: CompiledFlag; readonly negated: boolean } | undefined {
    const direct = byName[name];
    if (direct) {
      return { flag: direct, negated: false };
    }
    if (hasNoPrefix(name)) {
      const candidate = byName[name.slice(3)];
      if (candidate?.negatable) {
        return { flag: candidate, negated: true };
      }
    }

    return undefined;
  }

  function canConsumeNext(args: readonly string[], nextIndex: number): boolean {
    if (nextIndex >= args.length) {
      return false;
    }
    const next = args[nextIndex];
    if (next.length < 2 || next.charCodeAt(0) !== CHAR_DASH) {
      return true;
    }
    const c1 = next.charCodeAt(1);

    return c1 !== CHAR_DASH && !isShortStart(c1);
  }

  function parse(args: readonly string[]): ArgvParseResult {
    const flags: FlagValues = {};
    const provided: string[] = [];
    let positionals: string[] | undefined;
    let doubleDash: readonly string[] = EMPTY_STRINGS;
    let hasDoubleDash = false;
    let stoppedEarly = false;

    function shouldStop(
      kind: StopParsingTokenKind,
      raw: string,
      index: number,
    ): boolean {
      if (!stopPredicate) {
        return false;
      }

      return stopPredicate({
        kind,
        raw,
        index,
        positionalCount: positionals?.length ?? 0,
      });
    }

    function stopAt(index: number): void {
      stoppedEarly = true;
      positionals = positionals
        ? [...positionals, ...args.slice(index)]
        : args.slice(index);
    }
    let unknown: Record<string, RawInputType> | undefined;
    let missingValueFlags: string[] | undefined;
    let missingValueCandidates: Record<string, string> | undefined;
    let trailingMissingValueFlag: string | undefined;
    let invalidValues: InvalidFlagValue[] | undefined;

    function setFlag(key: string, val: FlagValues[string]): void {
      if (flags[key] === undefined) {
        provided.push(key);
      }
      flags[key] = val;
    }

    function assignValue(
      key: string,
      kind: "single" | "array",
      val: string | undefined,
      nextIndex: number,
    ): void {
      if (val === undefined) {
        missingValueFlags ??= [];
        if (!missingValueFlags.includes(key)) {
          missingValueFlags.push(key);
        }
        if (nextIndex >= args.length) {
          trailingMissingValueFlag = key;
        } else if (args[nextIndex] !== DOUBLE_DASH) {
          (missingValueCandidates ??= {})[key] ??= args[nextIndex];
        }
      } else if (kind === "array") {
        const prev = flags[key] as string[] | undefined;
        if (prev === undefined) {
          setFlag(key, [val]);
        } else {
          prev.push(val);
        }
      } else {
        setFlag(key, val);
      }
    }

    for (let i = 0; i < args.length; i++) {
      const current = args[i];
      const curLen = current.length;
      const c1 =
        curLen >= 2 && current.charCodeAt(0) === CHAR_DASH
          ? current.charCodeAt(1)
          : 0;

      if (c1 !== 0) {
        if (c1 === CHAR_DASH && curLen === 2) {
          hasDoubleDash = true;
          doubleDash = args.slice(i + 1);

          break;
        }

        if (c1 === CHAR_DASH) {
          const eq = current.indexOf("=", 2);
          const name = eq === -1 ? current.slice(2) : current.slice(2, eq);
          const resolved = resolveLongFlag(name);

          if (!resolved) {
            if (stopAtUnknownFlag || shouldStop("unknown-flag", current, i)) {
              stopAt(i);

              break;
            }
            (unknown ??= {})[camelCase(name)] =
              eq === -1 ? true : current.slice(eq + 1);

            continue;
          }

          if (shouldStop("known-flag", current, i)) {
            stopAt(i);

            break;
          }

          const {
            flag: { key, kind, optionalValue },
            negated,
          } = resolved;

          if (kind === "boolean" || kind === "counter") {
            const parsed =
              eq === -1 ? true : parseBooleanLiteral(current.slice(eq + 1));
            if (parsed === undefined) {
              (invalidValues ??= []).push({
                flag: key,
                value: current.slice(eq + 1),
                message: INVALID_BOOL_MSG,
              });
            } else if (kind === "boolean") {
              setFlag(key, negated ? !parsed : parsed);
            } else {
              const prev = flags[key] as number | undefined;
              if (prev === undefined) {
                setFlag(key, parsed ? 1 : 0);
              } else if (parsed) {
                flags[key] = prev + 1;
              }
            }
          } else if (eq === -1 && optionalValue) {
            setFlag(key, IMPLICIT_FLAG_VALUE);
          } else {
            const nextIndex = i + 1;
            const val =
              eq === -1
                ? canConsumeNext(args, nextIndex)
                  ? args[++i]
                  : undefined
                : current.slice(eq + 1);
            assignValue(key, kind, val, nextIndex);
          }

          continue;
        }

        if (isShortStart(c1)) {
          if (stopAtUnknownFlag || stopPredicate !== undefined) {
            const known = isKnownShortToken(current);
            if (
              (!known && stopAtUnknownFlag) ||
              shouldStop(known ? "known-flag" : "unknown-flag", current, i)
            ) {
              stopAt(i);

              break;
            }
          }

          for (let j = 1; j < curLen; j++) {
            const code = current.charCodeAt(j);
            const flag =
              code < 128 ? byShortCode?.[code] : byShortExtra?.[current[j]];
            if (flag === undefined) {
              (unknown ??= {})[current[j]] = true;

              continue;
            }

            const { key, kind, optionalValue } = flag;
            if (kind === "boolean") {
              setFlag(key, true);
            } else if (kind === "counter") {
              setFlag(key, ((flags[key] as number | undefined) ?? 0) + 1);
            } else {
              if (j + 1 >= curLen && optionalValue) {
                setFlag(key, IMPLICIT_FLAG_VALUE);

                break;
              }
              const nextIndex = i + 1;
              const val =
                j + 1 < curLen
                  ? current.slice(
                      current.charCodeAt(j + 1) === CHAR_EQ ? j + 2 : j + 1,
                    )
                  : canConsumeNext(args, nextIndex)
                    ? args[++i]
                    : undefined;
              assignValue(key, kind, val, nextIndex);

              break;
            }
          }

          continue;
        }
      }

      if (stopAtFirstPositional || shouldStop("positional", current, i)) {
        stopAt(i);

        break;
      }
      (positionals ??= []).push(current);
    }

    return {
      positionals: positionals ?? EMPTY_STRINGS,
      doubleDash,
      hasDoubleDash,
      stoppedEarly,
      flags,
      unknown: unknown ?? EMPTY_UNKNOWN,
      provided,
      missingValueFlags: missingValueFlags ?? EMPTY_STRINGS,
      missingValueCandidates: missingValueCandidates ?? EMPTY_CANDIDATES,
      trailingMissingValueFlag,
      invalidValues: invalidValues ?? EMPTY_INVALID,
    };
  }

  function scan(
    args: readonly string[],
    onPositional: ScanCallback,
    startIndex = 0,
  ): ScanResult {
    let i = startIndex;

    while (i < args.length) {
      const current = args[i];
      const curLen = current.length;
      const c1 =
        curLen >= 2 && current.charCodeAt(0) === CHAR_DASH
          ? current.charCodeAt(1)
          : 0;

      if (c1 !== 0) {
        if (c1 === CHAR_DASH && curLen === 2) {
          return { stoppedAt: i };
        }

        if (c1 === CHAR_DASH) {
          const eq = current.indexOf("=", 2);
          const name = eq === -1 ? current.slice(2) : current.slice(2, eq);
          const resolved = resolveLongFlag(name);
          if (!resolved) {
            return { stoppedAt: i };
          }

          i++;
          if (
            eq === -1 &&
            isValueKind(resolved.flag.kind) &&
            !resolved.flag.optionalValue &&
            canConsumeNext(args, i)
          ) {
            i++;
          }

          continue;
        }

        if (isShortStart(c1)) {
          let takesNext = false;
          for (let j = 1; j < curLen; j++) {
            const code = current.charCodeAt(j);
            const flag =
              code < 128 ? byShortCode?.[code] : byShortExtra?.[current[j]];
            if (flag === undefined) {
              return { stoppedAt: i };
            }
            if (isValueKind(flag.kind)) {
              takesNext = j === curLen - 1 && !flag.optionalValue;

              break;
            }
          }

          i++;
          if (takesNext && canConsumeNext(args, i)) {
            i++;
          }

          continue;
        }
      }

      if (!onPositional(current, i)) {
        return { stoppedAt: i };
      }
      i++;
    }

    return { stoppedAt: i };
  }

  return { parse, scan };
}
