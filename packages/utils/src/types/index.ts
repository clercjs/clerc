export type ToArray<T> = T extends any[] ? T : [T];
export type MaybeArray<T> = T | T[];

export type PartialRequired<T, K extends keyof T> = T & {
	[P in K]-?: T[P];
};

export type UnionToIntersection<U> = (
	U extends any ? (k: U) => void : never
) extends (k: infer I) => void
	? I
	: never;

export type * from "./type-fest";
