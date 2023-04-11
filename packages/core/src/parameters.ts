// Adapted from [privatenumber/cleye](https://github.com/privatenumber/cleye).
// Thanks for his awesome work!
import { camelCase } from "@clerc/utils";

import type { TranslateFn } from "./types";

const { stringify } = JSON;

interface ParsedParameter {
  name: string;
  required: boolean;
  spread: boolean;
}

export function parseParameters(parameters: string[], t: TranslateFn) {
  const parsedParameters: ParsedParameter[] = [];

  let hasOptional: string | undefined;
  let hasSpread: string | undefined;

  for (const parameter of parameters) {
    if (hasSpread) {
      throw new Error(t("core.spreadParameterMustBeLast", stringify(hasSpread)));
    }

    const firstCharacter = parameter[0];
    const lastCharacter = parameter[parameter.length - 1];

    let required: boolean | undefined;
    if (firstCharacter === "<" && lastCharacter === ">") {
      required = true;

      if (hasOptional) {
        throw new Error(t("core.requiredParameterMustBeBeforeOptional", stringify(parameter), stringify(hasOptional)));
      }
    }

    if (firstCharacter === "[" && lastCharacter === "]") {
      required = false;
      hasOptional = parameter;
    }

    if (required === undefined) {
      throw new Error(t("core.parameterMustBeWrappedInBrackets", stringify(parameter)));
    }

    let name = parameter.slice(1, -1);

    const spread = name.slice(-3) === "...";

    if (spread) {
      hasSpread = parameter;
      name = name.slice(0, -3);
    }

    parsedParameters.push({
      name,
      required,
      spread,
    });
  }

  return parsedParameters;
}

export function mapParametersToArguments(
  mapping: Record<string, string | string[]>,
  parameters: ParsedParameter[],
  cliArguments: string[],
  t: TranslateFn,
) {
  for (let i = 0; i < parameters.length; i += 1) {
    const { name, required, spread } = parameters[i];
    const camelCaseName = camelCase(name);
    if (camelCaseName in mapping) {
      throw new Error(t("core.parameterIsUsedMoreThanOnce", stringify(name)));
    }

    const value = spread ? cliArguments.slice(i) : cliArguments[i];

    if (spread) {
      i = parameters.length;
    }

    if (
      required
      && (!value || (spread && value.length === 0))
    ) {
      throw new Error(t("core.missingRequiredParameter", stringify(name)));
    }

    mapping[camelCaseName] = value;
  }
}
