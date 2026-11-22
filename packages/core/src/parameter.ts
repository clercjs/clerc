import { DOUBLE_DASH, camelCase } from "@clerc/parser";

import {
  InvalidParametersError,
  MissingRequiredParameterError,
} from "./errors";
import { convertValue } from "./schema";
import type {
  CoreSingleType,
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

interface CompiledParamItem extends ParameterInfo {
  readonly key: string;
  readonly type?: CoreSingleType;
}

export interface CompiledParameters {
  readonly main: readonly CompiledParamItem[];
  readonly doubleDash: readonly CompiledParamItem[];
}

export const normalizeParameterValue = (
  parameter: ParameterDefinitionValue,
): ParameterOptions =>
  typeof parameter === "string" ? { key: parameter } : parameter;

export function extractParameterInfo(key: string): ParameterInfo {
  const match = PARAMETER_REGEX.exec(key);
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

function compileParameterSlice(
  definitions: readonly ParameterDefinitionValue[],
): CompiledParamItem[] {
  const items: CompiledParamItem[] = [];
  const seen = new Set<string>();
  let hasOptional = false;

  for (let i = 0; i < definitions.length; i++) {
    const normalized = normalizeParameterValue(definitions[i]);
    const info = extractParameterInfo(normalized.key);

    if (seen.has(info.name)) {
      throw new InvalidParametersError(
        `duplicate parameter name: ${info.name}`,
      );
    }
    seen.add(info.name);

    if (info.isVariadic && i !== definitions.length - 1) {
      throw new InvalidParametersError(
        "variadic parameter must be the last parameter in the definition",
      );
    }
    if (info.isRequired) {
      if (hasOptional) {
        throw new InvalidParametersError(
          `required parameter "${info.name}" cannot appear after an optional parameter`,
        );
      }
    } else {
      hasOptional = true;
    }

    items.push({
      ...info,
      key: normalized.key,
      type: normalized.type,
    });
  }

  return items;
}

export function compileParameters(
  definitions: readonly ParameterDefinitionValue[],
): CompiledParameters {
  const doubleDashIndex = definitions.indexOf(DOUBLE_DASH);
  if (doubleDashIndex === -1) {
    return {
      main: compileParameterSlice(definitions),
      doubleDash: [],
    };
  }

  return {
    main: compileParameterSlice(definitions.slice(0, doubleDashIndex)),
    doubleDash: compileParameterSlice(definitions.slice(doubleDashIndex + 1)),
  };
}

async function applyCompiledSlice(
  items: readonly CompiledParamItem[],
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
        converted.push(await convertValue(item.type, element, item.key));
      }
      result[item.name] = converted;
    } else {
      result[item.name] =
        raw === undefined
          ? undefined
          : await convertValue(item.type, raw as string, item.key);
    }
  }
}

export async function executeCompiledParameters(
  compiled: CompiledParameters,
  parameters: readonly string[],
  doubleDashParameters: readonly string[],
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  await applyCompiledSlice(compiled.main, parameters, result);
  if (compiled.doubleDash.length > 0) {
    await applyCompiledSlice(compiled.doubleDash, doubleDashParameters, result);
  }

  return result;
}

export const parseParameters = async (
  definitions: readonly ParameterDefinitionValue[],
  parameters: readonly string[],
  doubleDashParameters: readonly string[],
): Promise<Record<string, unknown>> =>
  executeCompiledParameters(
    compileParameters(definitions),
    parameters,
    doubleDashParameters,
  );
