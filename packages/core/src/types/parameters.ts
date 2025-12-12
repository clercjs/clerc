import type { CamelCase, Prettify, UnionToIntersection } from "@clerc/utils";

type InferParameter<T extends string> = T extends
	| `<${infer Name extends string}...>`
	| `[${infer Name extends string}...]`
	? Record<CamelCase<Name>, string[]>
	: T extends `<${infer Name extends string}>`
		? Record<CamelCase<Name>, string>
		: T extends `[${infer Name extends string}]`
			? Record<CamelCase<Name>, string | undefined>
			: never;

export type InferParameters<T extends readonly string[]> =
	// line break for readability
	T extends readonly (infer U extends string)[]
		? Prettify<UnionToIntersection<InferParameter<U>>>
		: never;
