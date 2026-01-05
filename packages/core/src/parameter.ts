import { DOUBLE_DASH } from "@clerc/parser";
import { camelCase } from "@clerc/utils";

import { InvalidParametersError } from "./errors";
import type { ParameterDefinitionValue } from "./types/parameter";
import { normalizeParameterValue } from "./utils";

export function getParametersToResolve(argv: string[]): string[] {
  const parameters: string[] = [];

  for (const arg of argv) {
    if (arg.startsWith("-")) {
      break;
    }
    parameters.push(arg);
  }

  return parameters;
}

const PARAMETER_REGEX = /^(<|\[)([\w ]+)(\.\.\.)?(\]|>)$/;

const isParameterDefinitionBracketsValid = (definition: string): boolean =>
  (definition.startsWith("<") && definition.endsWith(">")) ||
  (definition.startsWith("[") && definition.endsWith("]"));

interface ParameterInfo {
  name: string;
  isRequired: boolean;
  isVariadic: boolean;
}

export function extractParameterInfo(key: string): ParameterInfo {
  const match = key.match(PARAMETER_REGEX);
  if (!match || !isParameterDefinitionBracketsValid(key)) {
    throw new InvalidParametersError(`Invalid parameter definition: ${key}`);
  }

  return {
    name: camelCase(match[2]),
    isRequired: key.startsWith("<"),
    isVariadic: !!match[3],
  };
}

function _parseParameters(
  definitions: readonly ParameterDefinitionValue[],
  parameters: string[],
): Record<string, any> {
  const result: Record<string, any> = {};
  let hasOptional = false;

  for (const [i, def] of definitions.entries()) {
    const normalized = normalizeParameterValue(def);
    const { name, isRequired, isVariadic } = extractParameterInfo(
      normalized.key,
    );

    if (Object.hasOwn(result, name)) {
      throw new InvalidParametersError(`Duplicate parameter name: ${name}`);
    }

    if (isVariadic && i !== definitions.length - 1) {
      throw new InvalidParametersError(
        "Variadic parameter must be the last parameter in the definition.",
      );
    }

    if (isRequired) {
      if (hasOptional) {
        throw new InvalidParametersError(
          `Required parameter "${name}" cannot appear after an optional parameter.`,
        );
      }
    } else {
      hasOptional = true;
    }

    const value = isVariadic ? parameters.slice(i) : parameters[i];

    if (isRequired && (isVariadic ? value.length === 0 : value === undefined)) {
      throw new InvalidParametersError(
        `Missing required ${isVariadic ? "variadic " : ""}parameter: ${name}`,
      );
    }

    if (normalized.type) {
      if (isVariadic) {
        result[name] = (value as string[]).map((v) => normalized.type!(v));
      } else if (value === undefined) {
        result[name] = value;
      } else {
        result[name] = normalized.type(value as string);
      }
    } else {
      result[name] = value;
    }
  }

  return result;
}

export function parseParameters(
  definitions: readonly ParameterDefinitionValue[],
  parameters: string[],
  doubleDashParameters: string[],
): Record<string, any> {
  // Use `definitions` without normalization here on purpose since we allow only string format for `--`
  const doubleDashIndex = definitions.indexOf(DOUBLE_DASH);

  if (doubleDashIndex === -1) {
    return _parseParameters(definitions, parameters);
  } else {
    const definitionBeforeDoubleDash = definitions.slice(0, doubleDashIndex);
    const definitionAfterDoubleDash = definitions.slice(doubleDashIndex + 1);

    return {
      ..._parseParameters(definitionBeforeDoubleDash, parameters),
      ..._parseParameters(definitionAfterDoubleDash, doubleDashParameters),
    };
  }
}
