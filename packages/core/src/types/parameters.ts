import type { CamelCase, Prettify, UnionToIntersection } from "@clerc/utils";

import type { ConstraintFunction } from "./constraint";

type InferStringParameter<T extends string, Type = string> = T extends
	| `<${infer Name extends string}...>`
	| `[${infer Name extends string}...]`
	? Record<CamelCase<Name>, Type[]>
	: T extends `<${infer Name extends string}>`
		? Record<CamelCase<Name>, Type>
		: T extends `[${infer Name extends string}]`
			? Record<CamelCase<Name>, Type | undefined>
			: never;

type InferParameter<T extends Parameter> = T extends string
	? InferStringParameter<T>
	: T extends ParameterDefinition
		? T["constraint"] extends ConstraintFunction<infer U>
			? InferStringParameter<T["key"], U>
			: InferStringParameter<T["key"]>
		: never;

export type InferParameters<T extends readonly Parameter[]> =
	// line break for readability
	T extends readonly (infer U extends Parameter)[]
		? Prettify<UnionToIntersection<InferParameter<U>>>
		: never;

export interface ParameterDefinition {
	key: string;
	constraint?: ConstraintFunction;
}
export type Parameter = string | ParameterDefinition;
