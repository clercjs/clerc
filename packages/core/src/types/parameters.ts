import type { Prettify, UnionToIntersection } from "@clerc/utils";

type InferParameter<T extends string> = T extends
	| `<${infer Name extends string}...>`
	| `[${infer Name extends string}...]`
	? Record<Name, string[]>
	: T extends `<${infer Name extends string}>`
		? Record<Name, string>
		: T extends `[${infer Name extends string}]`
			? Record<Name, string | undefined>
			: never;

export type InferParameters<T extends string[]> = T extends (infer U extends
	string)[]
	? Prettify<UnionToIntersection<InferParameter<U>>>
	: never;
