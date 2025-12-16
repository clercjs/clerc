import type { TypeFunction } from "@clerc/parser";
import type { CamelCase, Prettify, UnionToIntersection } from "@clerc/utils";

export declare interface ParameterCustomOptions {}

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
		? T["type"] extends TypeFunction<infer U>
			? InferStringParameter<T["key"], U>
			: InferStringParameter<T["key"]>
		: never;

export type InferParameters<T extends readonly Parameter[]> =
	// line break for readability
	T extends readonly (infer U extends Parameter)[]
		? Prettify<UnionToIntersection<InferParameter<U>>>
		: never;

export type ParameterDefinition = {
	key: string;
	description?: string;
	type?: TypeFunction;
} & ParameterCustomOptions;
export type Parameter = string | ParameterDefinition;
