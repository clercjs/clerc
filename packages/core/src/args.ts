import { DOUBLE_DASH, camelCase } from "@clerc/parser";

import {
  InvalidParametersError,
  MissingRequiredParameterError,
} from "./errors";
import { convertValue, isStandardSchema } from "./schema";
import type { ArgDefinitionValue, ArgOptions, CoreSingleType } from "./types";

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

export interface ParsedCommandSpec {
  readonly name: string;
  readonly argTokens: readonly string[];
}

interface CompiledArgItem extends ArgInfo {
  readonly type?: CoreSingleType;
}

export interface CompiledArgs {
  readonly main: readonly CompiledArgItem[];
  readonly doubleDash: readonly CompiledArgItem[];
}

export function normalizeArgValue(arg: ArgDefinitionValue): ArgOptions {
  if (typeof arg === "function" || isStandardSchema(arg)) {
    return { type: arg as CoreSingleType };
  }

  return arg as ArgOptions;
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
    isRequired: token.startsWith("<"),
    isVariadic: Boolean(match[3]),
  };
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
    items.push({
      ...info,
      type: norm?.type,
    });
  }

  return items;
}

export function compileArgs(
  argTokens: readonly string[],
  argDefs?: Readonly<Record<string, ArgDefinitionValue>>,
): CompiledArgs {
  const ddIdx = argTokens.indexOf(DOUBLE_DASH);
  if (ddIdx === -1) {
    return {
      main: compileArgSlice(argTokens, argDefs),
      doubleDash: [],
    };
  }

  return {
    main: compileArgSlice(argTokens.slice(0, ddIdx), argDefs),
    doubleDash: compileArgSlice(argTokens.slice(ddIdx + 1), argDefs),
  };
}

async function applyArgSlice(
  items: readonly CompiledArgItem[],
  values: readonly string[],
  result: Record<string, unknown>,
): Promise<void> {
  for (const [i, item] of items.entries()) {
    const raw = item.isVariadic ? values.slice(i) : values[i];

    if (
      item.isRequired &&
      (item.isVariadic ? (raw as string[]).length === 0 : raw === undefined)
    ) {
      throw new MissingRequiredParameterError(item.rawName, item.isVariadic);
    }

    if (!item.type) {
      result[item.name] = raw;
    } else if (item.isVariadic) {
      const converted: unknown[] = [];
      for (const element of raw as string[]) {
        converted.push(await convertValue(item.type, element, item.token));
      }
      result[item.name] = converted;
    } else {
      result[item.name] =
        raw === undefined
          ? undefined
          : await convertValue(item.type, raw as string, item.token);
    }
  }
}

export async function executeCompiledArgs(
  compiled: CompiledArgs,
  values: readonly string[],
  doubleDashValues: readonly string[],
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  await applyArgSlice(compiled.main, values, result);
  if (compiled.doubleDash.length > 0) {
    await applyArgSlice(compiled.doubleDash, doubleDashValues, result);
  }

  return result;
}
