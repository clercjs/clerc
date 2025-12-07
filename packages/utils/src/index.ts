export type Equals<X, Y> =
	(<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
		? true
		: false;
export type Dict<T> = Record<string, T>;
export type ToArray<T> = T extends any[] ? T : [T];
export type MaybeArray<T> = T | T[];

export const toArray = <T>(a: MaybeArray<T>): T[] =>
	Array.isArray(a) ? a : [a];

type AlphabetLowercase =
	| "a"
	| "b"
	| "c"
	| "d"
	| "e"
	| "f"
	| "g"
	| "h"
	| "i"
	| "j"
	| "k"
	| "l"
	| "m"
	| "n"
	| "o"
	| "p"
	| "q"
	| "r"
	| "s"
	| "t"
	| "u"
	| "v"
	| "w"
	| "x"
	| "y"
	| "z";
type Numeric = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type AlphaNumeric = AlphabetLowercase | Uppercase<AlphabetLowercase> | Numeric;

export type CamelCase<Word extends string> =
	Word extends `${infer FirstCharacter}${infer Rest}`
		? FirstCharacter extends AlphaNumeric
			? `${FirstCharacter}${CamelCase<Rest>}`
			: Capitalize<CamelCase<Rest>>
		: Word;
export const camelCase = (word: string): string =>
	word.replace(/[\W_]([a-z\d])?/gi, (_, c) => (c ? c.toUpperCase() : ""));

export type KebabCase<
	T extends string,
	A extends string = "",
> = T extends `${infer Prefix}${infer Suffix}`
	? KebabCase<
			Suffix,
			`${A}${Prefix extends Lowercase<Prefix> ? "" : "-"}${Lowercase<Prefix>}`
		>
	: A;
export const kebabCase = <T extends string>(s: T) =>
	s.replace(/([A-Z])/g, (_, c) => `-${c.toLowerCase()}`) as KebabCase<T>;

export const gracefulFlagName = (n: string): string =>
	n.length <= 1 ? `-${n}` : `--${kebabCase(n)}`;
export const gracefulVersion = (v: string): string =>
	v.length === 0 ? "" : v.startsWith("v") ? v : `v${v}`;
