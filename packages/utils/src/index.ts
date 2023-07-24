import type {
	Command,
	CommandType,
	Commands,
	I18N,
	RootType,
	TranslateFunction,
} from "@clerc/core";
import { Root, resolveFlattenCommands } from "@clerc/core";

import { locales } from "./locales";

export type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <
	T,
>() => T extends Y ? 1 : 2
	? true
	: false;
export type Dict<T> = Record<string, T>;
export type ToArray<T> = T extends any[] ? T : [T];
export type MaybeArray<T> = T | T[];

export const toArray = <T>(a: MaybeArray<T>) => (Array.isArray(a) ? a : [a]);

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
export const camelCase = (word: string) =>
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

export const gracefulFlagName = (n: string) =>
	n.length <= 1 ? `-${n}` : `--${kebabCase(n)}`;
export const gracefulVersion = (v: string) =>
	v.length === 0 ? "" : v.startsWith("v") ? v : `v${v}`;

export function arrayEquals<T>(array1: T[], array2: T[]) {
	if (array2.length !== array1.length) {
		return false;
	}

	return array1.every((item, index) => item === array2[index]);
}

export function arrayStartsWith<T>(array: T[], start: T[]) {
	if (start.length > array.length) {
		return false;
	}

	return arrayEquals(array.slice(0, start.length), start);
}

export function semanticArray(array: string[], { add, t }: I18N) {
	add(locales);
	if (array.length <= 1) {
		return array[0];
	}

	return t(
		"utils.and",
		array.slice(0, -1).join(", "),
		array[array.length - 1],
	)!;
}

export function resolveCommandStrict(
	commands: Commands,
	name: CommandType | string[],
	t: TranslateFunction,
): [Command<string | RootType> | undefined, string[] | RootType | undefined] {
	if (name === Root) {
		return [commands[Root], Root];
	}
	const nameArray = toArray(name);
	const commandsMap = resolveFlattenCommands(commands, t);
	let current: Command | undefined;
	let currentName: string[] | RootType | undefined;
	for (const [k, v] of commandsMap.entries()) {
		if (k === Root || currentName === Root) {
			continue;
		}
		if (arrayEquals(nameArray, k)) {
			current = v;
			currentName = k;
		}
	}

	return [current, currentName];
}

export function resolveSubcommandsByParent(
	commands: Commands,
	parent: string | string[],
	depth = Infinity,
) {
	const parentArray =
		parent === "" ? [] : Array.isArray(parent) ? parent : parent.split(" ");

	return Object.values(commands).filter((c) => {
		const commandNameArray = c.name.split(" ");

		return (
			arrayStartsWith(commandNameArray, parentArray) &&
			commandNameArray.length - parentArray.length <= depth
		);
	});
}

export const resolveRootCommands = (commands: Commands) =>
	resolveSubcommandsByParent(commands, "", 1);
