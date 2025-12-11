// Copied from "type-fest" package to avoid adding it as a dependency.

export type LiteralUnion<LiteralType, BaseType> =
	| LiteralType
	| (BaseType & Record<never, never>);

export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};
type Primitive = null | undefined | string | number | boolean | symbol | bigint;
type BuiltIns = Primitive | void | Date | RegExp;
type NonRecursiveType =
	| BuiltIns
	// eslint-disable-next-line ts/no-unsafe-function-type, ts/no-restricted-types
	| Function
	| (new (...arguments_: any[]) => unknown)
	| Promise<unknown>;
type UnknownArray = readonly unknown[];
type MapsSetsOrArrays =
	| ReadonlyMap<unknown, unknown>
	| WeakMap<WeakKey, unknown>
	| ReadonlySet<unknown>
	| WeakSet<WeakKey>
	| UnknownArray;
type ConditionalDeepPrettify<T, E = never, I = unknown> = T extends E
	? T
	: T extends I
		? { [TypeKey in keyof T]: ConditionalDeepPrettify<T[TypeKey], E, I> }
		: T;
export type DeepPrettify<T, E = never> = ConditionalDeepPrettify<
	T,
	E | NonRecursiveType | MapsSetsOrArrays,
	object
>;

export type IsAny<T> = 0 extends 1 & T ? true : false;
