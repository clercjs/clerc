import type { Command } from "@clerc/core";

export type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;
export type Dict<T> = Record<string, T>;
export type ToArray<T> = T extends any[] ? T : [T];
export type MaybeArray<T> = T | T[];
export type GetLength<T extends any[]> = T extends { length: infer L extends number } ? L : never;
export type GetTail<T extends any[]> = T extends [infer _Head, ...infer Tail] ? Tail : never;
type EnhanceSingle<T, E extends Dict<any>> = T & E;
export type Enhance<T, E extends Dict<any> | Dict<any>[]> = GetLength<ToArray<E>> extends 0 ? T : Enhance<EnhanceSingle<T, ToArray<E>[0]>, GetTail<ToArray<E>>>;

export const toArray = <T>(a: MaybeArray<T>) => Array.isArray(a) ? a : [a];

export type CamelCase<T extends string> = T extends `${infer A}-${infer B}${infer C}`
  ? `${A}${Capitalize<B>}${CamelCase<C>}`
  : T;
export const camelCase = <T extends string>(s: T): CamelCase<T> => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) as CamelCase<T>;

export type KebabCase<T extends string, A extends string = ""> = T extends `${infer F}${infer R}`
  ? KebabCase<R, `${A}${F extends Lowercase<F> ? "" : "-"}${Lowercase<F>}`>
  : A;
export const kebabCase = <T extends string>(s: T): KebabCase<T> => s.replace(/([A-Z])/g, (_, c) => `-${c.toLowerCase()}`) as KebabCase<T>;

export const gracefulFlagName = (n: string) => n.length <= 1 ? `-${n}` : `--${kebabCase(n)}`;
export const gracefulVersion = (v: string) =>
  v.length === 0
    ? ""
    : v.startsWith("v")
      ? v
      : `v${v}`;

export const arrayEquals = <T>(arr1: T[], arr2: T[]) => {
  if (arr2.length !== arr1.length) {
    return false;
  }
  return arr1.every((item, i) => item === arr2[i]);
};

export const arrayStartsWith = <T>(arr: T[], start: T[]) => {
  if (start.length > arr.length) {
    return false;
  }
  return arrayEquals(arr.slice(0, start.length), start);
};

export const generateCommandRecordFromCommandArray = <C extends Command>(commands: C[]) => {
  const record = {} as Dict<C>;
  for (const command of commands) {
    record[command.name] = command;
  }
  return record;
};

export const semanticArray = (arr: string[]) => {
  if (arr.length <= 1) {
    return arr[0];
  }
  return `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`;
};
