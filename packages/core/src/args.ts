import {
  InvalidParametersError,
  MissingRequiredParameterError,
  UnexpectedArgumentError,
} from "./errors";
import { DOUBLE_DASH } from "./parser";
import type { TypeConverter } from "./schema";
import { describeType, isStandardSchema } from "./schema";
import type {
  AnyCommandDefinition,
  ArgDefinitionValue,
  ArgOptions,
  CoreSingleType,
} from "./types";
import { camelCase } from "./utils";

const ARG_TOKEN_REGEX = /^(<|\[)([\w-]+)(\.\.\.)?(\]|>)$/;

const isArgToken = (token: string): boolean =>
  token === DOUBLE_DASH || token.startsWith("<") || token.startsWith("[");

export interface ArgInfo {
  readonly name: string;
  readonly rawName: string;
  readonly token: string;
  readonly isRequired: boolean;
  readonly isVariadic: boolean;
}

export interface ResolvedArg extends ArgInfo {
  readonly options: ArgOptions;
  readonly afterDoubleDash: boolean;
}

export interface ParsedCommandSpec {
  readonly name: string;
  readonly argTokens: readonly string[];
}

interface CompiledArgItem extends ArgInfo {
  readonly convert?: TypeConverter;
  readonly default?: unknown;
  readonly env?: string;
}

export interface CompiledArgs {
  readonly main: readonly CompiledArgItem[];
  readonly doubleDash: readonly CompiledArgItem[];
  readonly hasDoubleDashSpec: boolean;
}

export function normalizeArgValue(arg: ArgDefinitionValue): ArgOptions {
  if (typeof arg === "function" || isStandardSchema(arg)) {
    return { type: arg as CoreSingleType };
  }

  return arg as ArgOptions;
}

export function splitArgTokens(argTokens: readonly string[]): {
  readonly main: readonly string[];
  readonly doubleDash: readonly string[];
} {
  const ddIdx = argTokens.indexOf(DOUBLE_DASH);

  return ddIdx === -1
    ? { main: argTokens, doubleDash: [] }
    : {
        main: argTokens.slice(0, ddIdx),
        doubleDash: argTokens.slice(ddIdx + 1),
      };
}

export function extractArgInfo(token: string): ArgInfo {
  const match = ARG_TOKEN_REGEX.exec(token);
  if (
    !match ||
    (match[1] === "<" && match[4] !== ">") ||
    (match[1] === "[" && match[4] !== "]")
  ) {
    throw new InvalidParametersError(`invalid argument definition: ${token}`);
  }

  return {
    name: camelCase(match[2]),
    rawName: match[2],
    token,
    isRequired: match[1] === "<",
    isVariadic: Boolean(match[3]),
  };
}

export function resolveCommandArgs(
  cmd: Pick<AnyCommandDefinition, "argTokens" | "args">,
): readonly ResolvedArg[] {
  const { main, doubleDash } = splitArgTokens(cmd.argTokens);
  function toResolved(token: string, afterDoubleDash: boolean): ResolvedArg {
    const info = extractArgInfo(token);
    const rawDef = cmd.args?.[info.name];

    return {
      ...info,
      options: rawDef ? normalizeArgValue(rawDef) : {},
      afterDoubleDash,
    };
  }

  return [
    ...main.map((token) => toResolved(token, false)),
    ...doubleDash.map((token) => toResolved(token, true)),
  ];
}

/**
 * Splits a command signature like `"deploy <target> [region] -- [extra...]"`
 * into its command name (`"deploy"`) and ordered positional argument tokens.
 */
export function parseCommandSpec(spec: string): ParsedCommandSpec {
  const trimmed = spec.trim();
  if (trimmed === "") {
    return { name: "", argTokens: [] };
  }

  const tokens = trimmed.split(/\s+/);
  const nameTokens: string[] = [];
  const argTokens: string[] = [];

  for (const token of tokens) {
    if (argTokens.length > 0 || isArgToken(token)) {
      if (!isArgToken(token)) {
        throw new InvalidParametersError(
          `unexpected command segment "${token}" after argument in "${spec}"`,
        );
      }
      argTokens.push(token);
    } else {
      nameTokens.push(token);
    }
  }

  return {
    name: nameTokens.join(" "),
    argTokens,
  };
}

function compileArgSlice(
  tokens: readonly string[],
  argDefs?: Readonly<Record<string, ArgDefinitionValue>>,
): CompiledArgItem[] {
  const items: CompiledArgItem[] = [];
  const seen = new Set<string>();
  let hasOptional = false;

  for (let i = 0; i < tokens.length; i++) {
    const info = extractArgInfo(tokens[i]);

    if (seen.has(info.name)) {
      throw new InvalidParametersError(`duplicate argument name: ${info.name}`);
    }
    seen.add(info.name);

    if (info.isVariadic && i !== tokens.length - 1) {
      throw new InvalidParametersError(
        "variadic argument must be the last argument in the signature",
      );
    }
    if (info.isRequired) {
      if (hasOptional) {
        throw new InvalidParametersError(
          `required argument "${info.name}" cannot appear after an optional argument`,
        );
      }
    } else {
      hasOptional = true;
    }

    const def = argDefs?.[info.name];
    const norm = def ? normalizeArgValue(def) : undefined;
    if (info.isRequired && norm?.default !== undefined) {
      throw new InvalidParametersError(
        `required argument "${info.name}" cannot have a default value`,
      );
    }
    items.push({
      ...info,
      convert: norm?.type ? describeType(norm.type).convert : undefined,
      default: norm?.default,
      env: norm?.env,
    });
  }

  return items;
}

export function compileArgs(
  argTokens: readonly string[],
  argDefs?: Readonly<Record<string, ArgDefinitionValue>>,
): CompiledArgs {
  const { main, doubleDash } = splitArgTokens(argTokens);

  return {
    main: compileArgSlice(main, argDefs),
    doubleDash: compileArgSlice(doubleDash, argDefs),
    hasDoubleDashSpec: argTokens.includes(DOUBLE_DASH),
  };
}

async function convertArgItems(
  item: CompiledArgItem,
  elements: readonly string[],
): Promise<unknown[]> {
  if (!item.convert) {
    return [...elements];
  }
  const converted: unknown[] = [];
  for (const element of elements) {
    converted.push(await item.convert(element, item.token));
  }

  return converted;
}

async function applyArgSlice(
  items: readonly CompiledArgItem[],
  values: readonly string[],
  result: Record<string, unknown>,
  env: Readonly<Record<string, string | undefined>>,
): Promise<void> {
  const hasVariadic = items.some((item) => item.isVariadic);
  if (!hasVariadic && values.length > items.length) {
    throw new UnexpectedArgumentError(values.slice(items.length));
  }

  for (const [i, item] of items.entries()) {
    const raw = item.isVariadic ? values.slice(i) : values[i];
    const isMissing = item.isVariadic
      ? (raw as string[]).length === 0
      : raw === undefined;

    if (!isMissing) {
      result[item.name] = item.isVariadic
        ? await convertArgItems(item, raw as string[])
        : item.convert
          ? await item.convert(raw as string, item.token)
          : raw;

      continue;
    }

    const envValue = item.env ? env[item.env] : undefined;
    if (envValue !== undefined && envValue !== "") {
      result[item.name] = item.isVariadic
        ? await convertArgItems(
            item,
            envValue.split(",").map((s) => s.trim()),
          )
        : item.convert
          ? await item.convert(envValue, item.token)
          : envValue;

      continue;
    }

    if (item.default !== undefined) {
      result[item.name] =
        typeof item.default === "function"
          ? (item.default as () => unknown)()
          : item.default;

      continue;
    }

    if (item.isRequired) {
      const hints = item.env
        ? [`provide '${item.token}' or set ${item.env}`]
        : undefined;

      throw new MissingRequiredParameterError(
        item.rawName,
        item.isVariadic,
        hints,
      );
    }

    result[item.name] = item.isVariadic ? [] : undefined;
  }
}

export async function executeCompiledArgs(
  compiled: CompiledArgs,
  values: readonly string[],
  doubleDashValues: readonly string[],
  env: Readonly<Record<string, string | undefined>> = {},
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  if (compiled.doubleDash.length > 0) {
    await applyArgSlice(compiled.main, values, result, env);
    await applyArgSlice(compiled.doubleDash, doubleDashValues, result, env);
  } else if (compiled.hasDoubleDashSpec) {
    await applyArgSlice(compiled.main, values, result, env);
  } else {
    const combined =
      doubleDashValues.length > 0 ? [...values, ...doubleDashValues] : values;
    await applyArgSlice(compiled.main, combined, result, env);
  }

  return result;
}
