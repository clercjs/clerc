export type MaybeArray<T> = T | readonly T[];
export type MaybeAsyncGetter<T, Arg = void> =
  T | ((arg: Arg) => T | Promise<T>);

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type CamelCase<S extends string> =
  S extends `${infer Head} ${infer Tail}`
    ? `${Head}${Capitalize<CamelCase<Tail>>}`
    : S extends `${infer Head}-${infer Tail}`
      ? `${Head}${Capitalize<CamelCase<Tail>>}`
      : S;

export type IsAny<T> = 0 extends 1 & T ? true : false;

export const toArray = <T>(value: MaybeArray<T>): T[] =>
  Array.isArray(value) ? [...value] : [value as T];

export const camelCase = (str: string): string =>
  str.includes("-") || str.includes(" ")
    ? str.replace(/[- ](.?)/g, (_, c: string) => c.toUpperCase())
    : str;

export const kebabCase = (str: string): string =>
  str.replace(/([A-Z])/g, (_, c: string) => `-${c.toLowerCase()}`);

export const formatFlagName = (name: string): string =>
  name.length <= 1 ? `-${name}` : `--${kebabCase(name)}`;

export const formatVersion = (version: string): string =>
  version.length === 0 ? "" : version.startsWith("v") ? version : `v${version}`;

export function joinWithAnd(values: readonly string[]): string {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}

export const resolveAsyncValue = async <T, Arg = void>(
  value: MaybeAsyncGetter<T, Arg>,
  arg?: Arg,
): Promise<T> =>
  typeof value === "function"
    ? (value as (a: Arg) => T | Promise<T>)(arg as Arg)
    : value;
