import {
  InvalidArgumentError,
  InvalidCommandError,
  MissingRequiredArgumentError,
  UnexpectedArgumentError,
} from "./errors";
import { convertItemList } from "./flags";
import { DOUBLE_DASH } from "./parser";
import type { TypeConverter } from "./schema";
import { describeType, isStandardSchema } from "./schema";
import type {
  ArgDefinitionValue,
  ArgDescriptor,
  ArgOptions,
  SingleType,
} from "./types";
import { camelCase, evaluateDefault } from "./utils";

const ARG_TOKEN_REGEX = /^(<|\[)([\w-]+)(\.\.\.)?(\]|>)$/;

const isArgToken = (token: string): boolean =>
  token === DOUBLE_DASH || token.startsWith("<") || token.startsWith("[");

const defaultStringJsonSchema = (): Record<string, unknown> => ({
  type: "string",
});

export interface ParsedCommandSpec {
  readonly name: string;
  readonly argTokens: readonly string[];
}

export interface CompiledArgItem extends ArgDescriptor {
  readonly convert?: TypeConverter;
}

export interface CompiledArgs {
  readonly descriptors: readonly ArgDescriptor[];
  readonly main: readonly CompiledArgItem[];
  readonly doubleDash: readonly CompiledArgItem[];
  readonly hasDoubleDashSpec: boolean;
}

function normalizeArgValue(arg: ArgDefinitionValue): ArgOptions {
  if (typeof arg === "function" || isStandardSchema(arg)) {
    return { type: arg as SingleType };
  }

  return arg as ArgOptions;
}

function splitArgTokens(argTokens: readonly string[]): {
  readonly main: readonly string[];
  readonly doubleDash: readonly string[];
  readonly hasDoubleDash: boolean;
} {
  const ddIdx = argTokens.indexOf(DOUBLE_DASH);

  return ddIdx === -1
    ? { main: argTokens, doubleDash: [], hasDoubleDash: false }
    : {
        main: argTokens.slice(0, ddIdx),
        doubleDash: argTokens.slice(ddIdx + 1),
        hasDoubleDash: true,
      };
}

function parseArgToken(token: string): {
  readonly name: string;
  readonly rawName: string;
  readonly token: string;
  readonly isRequired: boolean;
  readonly isVariadic: boolean;
} {
  const match = ARG_TOKEN_REGEX.exec(token);
  if (
    !match ||
    (match[1] === "<" && match[4] !== ">") ||
    (match[1] === "[" && match[4] !== "]")
  ) {
    throw new InvalidArgumentError(`invalid argument definition: ${token}`);
  }

  return {
    name: camelCase(match[2]),
    rawName: match[2],
    token,
    isRequired: match[1] === "<",
    isVariadic: Boolean(match[3]),
  };
}

export function parseCommandSpec(spec: string): ParsedCommandSpec {
  const trimmed = spec.trim();
  if (trimmed === "") {
    throw new InvalidCommandError(
      "command spec cannot be empty; pass options directly to command({ ... }) to register a root command",
    );
  }

  const tokens = trimmed.split(/\s+/);
  const nameTokens: string[] = [];
  const argTokens: string[] = [];

  for (const token of tokens) {
    if (argTokens.length > 0 || isArgToken(token)) {
      if (!isArgToken(token)) {
        throw new InvalidArgumentError(
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
  argDefs: Readonly<Record<string, ArgDefinitionValue>> | undefined,
  afterDoubleDash: boolean,
  seen: Set<string>,
): CompiledArgItem[] {
  const items: CompiledArgItem[] = [];
  let hasOptional = false;

  for (let i = 0; i < tokens.length; i++) {
    const info = parseArgToken(tokens[i]);

    if (seen.has(info.name)) {
      throw new InvalidArgumentError(`duplicate argument name: ${info.name}`);
    }
    seen.add(info.name);

    if (info.isVariadic && i !== tokens.length - 1) {
      throw new InvalidArgumentError(
        "variadic argument must be the last argument in the signature",
      );
    }
    if (info.isRequired) {
      if (hasOptional) {
        throw new InvalidArgumentError(
          `required argument "${info.name}" cannot appear after an optional argument`,
        );
      }
    } else {
      hasOptional = true;
    }

    const def = argDefs?.[info.name];
    const norm = def ? normalizeArgValue(def) : undefined;
    if (info.isRequired && norm?.default !== undefined) {
      throw new InvalidArgumentError(
        `required argument "${info.name}" cannot have a default value`,
      );
    }

    const typeDesc = norm?.type ? describeType(norm.type) : undefined;
    items.push({
      ...info,
      afterDoubleDash,
      display: typeDesc?.display,
      description: norm?.description,
      placeholder: norm?.placeholder,
      default: norm?.default,
      env: norm?.env,
      meta: norm?.meta,
      toJsonSchema: typeDesc ? typeDesc.toJsonSchema : defaultStringJsonSchema,
      convert: typeDesc?.convert,
    });
  }

  return items;
}

export function compileArgs(
  argTokens: readonly string[],
  argDefs?: Readonly<Record<string, ArgDefinitionValue>>,
): CompiledArgs {
  const { main, doubleDash, hasDoubleDash } = splitArgTokens(argTokens);
  const seen = new Set<string>();
  const compiledMain = compileArgSlice(main, argDefs, false, seen);
  const compiledDd = compileArgSlice(doubleDash, argDefs, true, seen);

  if (argDefs) {
    for (const key of Object.keys(argDefs)) {
      if (!seen.has(key)) {
        throw new InvalidArgumentError(
          `argument "${key}" is not defined in command signature`,
        );
      }
    }
  }

  return {
    descriptors: [...compiledMain, ...compiledDd],
    main: compiledMain,
    doubleDash: compiledDd,
    hasDoubleDashSpec: hasDoubleDash,
  };
}

async function convertArgValue(
  item: CompiledArgItem,
  raw: string | readonly string[],
): Promise<unknown> {
  if (Array.isArray(raw)) {
    return convertItemList(item.convert, item.token, raw);
  }

  return item.convert ? item.convert(raw as string, item.token) : raw;
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
      result[item.name] = await convertArgValue(item, raw);

      continue;
    }

    const envValue = item.env ? env[item.env] : undefined;
    if (envValue !== undefined && envValue !== "") {
      result[item.name] = await convertArgValue(
        item,
        item.isVariadic ? envValue.split(",").map((s) => s.trim()) : envValue,
      );

      continue;
    }

    if (item.default !== undefined) {
      result[item.name] = evaluateDefault(item.default);

      continue;
    }

    if (item.isRequired) {
      const hints = item.env
        ? [`provide '${item.token}' or set ${item.env}`]
        : undefined;

      throw new MissingRequiredArgumentError(
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
