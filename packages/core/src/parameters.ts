import type { MaybeArray } from "@clerc/utils";

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

export function parseParameters(
	definitions: string[],
	parameters: string[],
): Record<string, any> {
	const result: Record<string, MaybeArray<string>> = {};
	let hasOptional = false;

	for (const [i, definition] of definitions.entries()) {
		const match = definition.match(PARAMETER_REGEX);
		if (!match || !isParameterDefinitionBracketsValid(definition)) {
			throw new Error(`Invalid parameter definition: ${definition}`);
		}

		const name = match[2];
		const isVariadic = !!match[3];
		const isRequired = definition.startsWith("<");

		if (name in result) {
			throw new Error(`Duplicate parameter name: ${name}`);
		}

		if (isVariadic && i !== definitions.length - 1) {
			throw new Error(
				"Variadic parameter must be the last parameter in the definition.",
			);
		}

		if (isRequired) {
			if (hasOptional) {
				throw new Error(
					`Required parameter "${name}" cannot appear after an optional parameter.`,
				);
			}
		} else {
			hasOptional = true;
		}

		const value = isVariadic ? parameters.slice(i) : parameters[i];

		if (isRequired && (isVariadic ? value.length === 0 : value === undefined)) {
			throw new Error(
				`Missing required ${isVariadic ? "variadic " : ""}parameter: ${name}`,
			);
		}

		result[name] = value;
	}

	return result;
}
