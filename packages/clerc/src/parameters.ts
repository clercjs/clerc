// Adapted from [privatenumber/cleye](https://github.com/privatenumber/cleye).
// Thanks for his awesome work!
import { camelCase } from "@clerc/utils";

const { stringify } = JSON;

interface ParsedParameter {
  name: string
  required: boolean
  spread: boolean
}

export function parseParameters (parameters: string[]) {
  const parsedParameters: ParsedParameter[] = [];

  let hasOptional: string | undefined;
  let hasSpread: string | undefined;

  for (const parameter of parameters) {
    if (hasSpread) {
      throw new Error(`Invalid parameter: Spread parameter ${stringify(hasSpread)} must be last`);
    }

    const firstCharacter = parameter[0];
    const lastCharacter = parameter[parameter.length - 1];

    let required: boolean | undefined;
    if (firstCharacter === "<" && lastCharacter === ">") {
      required = true;

      if (hasOptional) {
        throw new Error(`Invalid parameter: Required parameter ${stringify(parameter)} cannot come after optional parameter ${stringify(hasOptional)}`);
      }
    }

    if (firstCharacter === "[" && lastCharacter === "]") {
      required = false;
      hasOptional = parameter;
    }

    if (required === undefined) {
      throw new Error(`Invalid parameter: ${stringify(parameter)}. Must be wrapped in <> (required parameter) or [] (optional parameter)`);
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

export function mapParametersToArguments (
  mapping: Record<string, string | string[]>,
  parameters: ParsedParameter[],
  cliArguments: string[],
) {
  for (let i = 0; i < parameters.length; i += 1) {
    const { name, required, spread } = parameters[i];
    const camelCaseName = camelCase(name);
    if (camelCaseName in mapping) {
      throw new Error(`Invalid parameter: ${stringify(name)} is used more than once.`);
    }

    const value = spread ? cliArguments.slice(i) : cliArguments[i];

    if (spread) {
      i = parameters.length;
    }

    if (
      required
      && (!value || (spread && value.length === 0))
    ) {
      console.error(`Error: Missing required parameter ${stringify(name)}\n`);
      return process.exit(1);
    }

    mapping[camelCaseName] = value;
  }
}
