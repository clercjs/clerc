/**
 * Copied from type-fest
 */
export type Primitive =
  | null
  | undefined
  | string
  | number
  | boolean
  | symbol
  | bigint;
/**
* Copied from type-fest
*/
export type LiteralUnion<
  LiteralType, BaseType extends Primitive,
> = LiteralType | (BaseType & Record<never, never>);
export type Dict<T> = Record<string, T>;
export type MustArray<T> = T extends any[] ? T : [T];
export type MaybeArray<T> = T | T[];
export type GetLength<T extends any[]> = T extends { length: infer L extends number } ? L : never;
export type GetTail<T extends any[]> = T extends [infer _Head, ...infer Tail] ? Tail : never;
type EnhanceSingle<T, E extends Dict<any>> = T & E;
export type Enhance<T, E extends Dict<any> | Dict<any>[]> = GetLength<MustArray<E>> extends 0 ? T : Enhance<EnhanceSingle<T, MustArray<E>[0]>, GetTail<MustArray<E>>>;

export const mustArray = <T>(a: MaybeArray<T>) => Array.isArray(a) ? a : [a];

export type CamelCase<T extends string> = T extends `${infer A}-${infer B}${infer C}`
  ? `${A}${Capitalize<B>}${CamelCase<C>}`
  : T;
export const camelCase = <T extends string>(s: T): CamelCase<T> => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) as CamelCase<T>;

export type KebabCase<T extends string, A extends string = ""> = T extends `${infer F}${infer R}`
  ? KebabCase<R, `${A}${F extends Lowercase<F> ? "" : "-"}${Lowercase<F>}`>
  : A;
export const kebabCase = <T extends string>(s: T): KebabCase<T> => s.replace(/([A-Z])/g, (_, c) => `-${c.toLowerCase()}`) as KebabCase<T>;

export const gracefulFlagName = (n: string) => n.length <= 1 ? `-${n}` : `--${n}`;
export const gracefulVersion = (v: string) =>
  v.length === 0
    ? ""
    : v.startsWith("v")
      ? v
      : `v${v}`;
