import { DOUBLE_DASH } from "@clerc/parser";
import type { MaybeArray } from "@clerc/utils";

import { InvalidParametersError } from "./errors";

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

const PARAMETER_REGEX = /^(<|\[)(\w+)(\.\.\.)?(\]|>)$/;

const isParameterDefinitionBracketsValid = (definition: string): boolean =>
	(definition.startsWith("<") && definition.endsWith(">")) ||
	(definition.startsWith("[") && definition.endsWith("]"));

function _parseParameters(
	definitions: string[],
	parameters: string[],
): Record<string, any> {
	const result: Record<string, MaybeArray<string>> = {};
	let hasOptional = false;

	for (const [i, definition] of definitions.entries()) {
		const match = definition.match(PARAMETER_REGEX);
		if (!match || !isParameterDefinitionBracketsValid(definition)) {
			throw new InvalidParametersError(
				`Invalid parameter definition: ${definition}`,
			);
		}

		const name = match[2];
		const isVariadic = !!match[3];
		const isRequired = definition.startsWith("<");

		if (name in result) {
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

		result[name] = value;
	}

	return result;
}

export function parseParameters(
	definitions: string[],
	parameters: string[],
	doubleDashParameters: string[],
): Record<string, any> {
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
