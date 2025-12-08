/**
 * Copied from "type-fest" package to avoid adding it as a dependency.
 */
export type LiteralUnion<LiteralType, BaseType> =
	| LiteralType
	| (BaseType & Record<never, never>);

export type ToArray<T> = T extends any[] ? T : [T];
export type MaybeArray<T> = T | T[];
export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export type PartialRequired<T, K extends keyof T> = T & {
	[P in K]-?: T[P];
};
