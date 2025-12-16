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

type InferParameter<T extends ParameterDefinitionValue> = T extends string
	? InferStringParameter<T>
	: T extends ParameterOptions
		? T["type"] extends TypeFunction<infer U>
			? InferStringParameter<T["key"], U>
			: InferStringParameter<T["key"]>
		: never;

export type InferParameters<T extends readonly ParameterDefinitionValue[]> =
	// line break for readability
	T extends readonly (infer U extends ParameterDefinitionValue)[]
		? Prettify<UnionToIntersection<InferParameter<U>>>
		: never;

export type ParameterOptions = {
	key: string;
	description?: string;
	type?: TypeFunction;
} & ParameterCustomOptions;
export type ParameterDefinitionValue = string | ParameterOptions;
