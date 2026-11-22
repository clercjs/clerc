import { DOUBLE_DASH, camelCase } from "@clerc/parser";

import {
  InvalidParametersError,
  MissingRequiredParameterError,
} from "./errors";
import { convertValue, isStandardSchema } from "./schema";
import type {
  ClercFlagDefinitionValue,
  ClercFlagOptions,
  ParameterDefinitionValue,
  ParameterOptions,
} from "./types";

const PARAMETER_REGEX = /^(<|\[)([\w -]+)(\.\.\.)?(\]|>)$/;

const isParameterBracketsValid = (definition: string): boolean =>
  (definition.startsWith("<") && definition.endsWith(">")) ||
  (definition.startsWith("[") && definition.endsWith("]"));

export interface ParameterInfo {
  readonly name: string;
  readonly rawName: string;
  readonly isRequired: boolean;
  readonly isVariadic: boolean;
}

export function normalizeFlagValue(
  flag: ClercFlagDefinitionValue,
): ClercFlagOptions {
  if (
    typeof flag === "function" ||
    Array.isArray(flag) ||
    isStandardSchema(flag)
  ) {
    return { type: flag as any };
  }

  return flag as ClercFlagOptions;
}

export const normalizeParameterValue = (
  parameter: ParameterDefinitionValue,
): ParameterOptions =>
  typeof parameter === "string" ? { key: parameter } : parameter;

export function extractParameterInfo(key: string): ParameterInfo {
  const match = key.match(PARAMETER_REGEX);
  if (!match || !isParameterBracketsValid(key)) {
    throw new InvalidParametersError(`invalid parameter definition: ${key}`);
  }

  return {
    name: camelCase(match[2]),
    rawName: match[2],
    isRequired: key.startsWith("<"),
    isVariadic: Boolean(match[3]),
  };
}

async function parseParameterSlice(
  definitions: readonly ParameterDefinitionValue[],
  values: readonly string[],
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  let hasOptional = false;

  for (const [i, def] of definitions.entries()) {
    const normalized = normalizeParameterValue(def);
    const { name, rawName, isRequired, isVariadic } = extractParameterInfo(
      normalized.key,
    );

    if (Object.hasOwn(result, name)) {
      throw new InvalidParametersError(`duplicate parameter name: ${name}`);
    }
    if (isVariadic && i !== definitions.length - 1) {
      throw new InvalidParametersError(
        "variadic parameter must be the last parameter in the definition",
      );
    }
    if (isRequired) {
      if (hasOptional) {
        throw new InvalidParametersError(
          `required parameter "${name}" cannot appear after an optional parameter`,
        );
      }
    } else {
      hasOptional = true;
    }

    const raw = isVariadic ? values.slice(i) : values[i];
    if (
      isRequired &&
      (isVariadic ? (raw as string[]).length === 0 : raw === undefined)
    ) {
      throw new MissingRequiredParameterError(rawName, isVariadic);
    }

    if (!normalized.type) {
      result[name] = raw;
    } else if (isVariadic) {
      const converted: unknown[] = [];
      for (const item of raw as string[]) {
        converted.push(
          await convertValue(normalized.type, item, normalized.key),
        );
      }
      result[name] = converted;
    } else {
      result[name] =
        raw === undefined
          ? undefined
          : await convertValue(normalized.type, raw as string, normalized.key);
    }
  }

  return result;
}

export async function parseParameters(
  definitions: readonly ParameterDefinitionValue[],
  parameters: readonly string[],
  doubleDashParameters: readonly string[],
): Promise<Record<string, unknown>> {
  const doubleDashIndex = definitions.indexOf(DOUBLE_DASH);
  if (doubleDashIndex === -1) {
    return parseParameterSlice(definitions, parameters);
  }

  return {
    ...(await parseParameterSlice(
      definitions.slice(0, doubleDashIndex),
      parameters,
    )),
    ...(await parseParameterSlice(
      definitions.slice(doubleDashIndex + 1),
      doubleDashParameters,
    )),
  };
}
