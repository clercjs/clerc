export type MaybeArray<T> = T | readonly T[];
export type MaybeAsyncGetter<T, Arg = void> =
  T | ((arg: Arg) => T | Promise<T>);

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export type CamelCase<S extends string> =
  S extends `${infer Head} ${infer Tail}`
    ? `${CamelCase<Head>}${Capitalize<CamelCase<Tail>>}`
    : S extends `${infer Head}-${infer Tail}`
      ? `${CamelCase<Head>}${Capitalize<CamelCase<Tail>>}`
      : S;

export type IsAny<T> = 0 extends 1 & T ? true : false;

export const EMPTY_ARRAY: readonly never[] = Object.freeze([]);

export const toArray = <T>(value: MaybeArray<T>): T[] =>
  Array.isArray(value) ? [...value] : [value as T];

export const camelCase = (str: string): string =>
  str.includes("-") || str.includes(" ")
    ? str.replace(/[- ](.?)/g, (_, c: string) => c.toUpperCase())
    : str;

export function kebabCase(str: string): string {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      let out = str.slice(0, i);
      for (let j = i; j < str.length; j++) {
        const ch = str.charCodeAt(j);
        out +=
          ch >= 65 && ch <= 90 ? `-${String.fromCharCode(ch + 32)}` : str[j];
      }

      return out;
    }
  }

  return str;
}

export const formatFlagName = (name: string): string =>
  name.length <= 1 ? `-${name}` : `--${kebabCase(name)}`;

export const plural = (
  count: number,
  singular: string,
  pluralForm = `${singular}s`,
): string => (count === 1 ? singular : pluralForm);

export const formatVersion = (version: string): string =>
  version.length === 0 ? "" : version.startsWith("v") ? version : `v${version}`;

export function joinList(
  values: readonly string[],
  conjunction: "and" | "or" = "and",
): string {
  if (values.length <= 1) {
    return values[0] ?? "";
  }
  if (values.length === 2) {
    return `${values[0]} ${conjunction} ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, ${conjunction} ${values.at(-1)}`;
}

export function evaluateDefault(value: unknown): unknown {
  if (typeof value === "function") {
    return (value as () => unknown)();
  }

  return Array.isArray(value) ? [...value] : value;
}

export const resolveAsyncValue = async <T, Arg = void>(
  value: MaybeAsyncGetter<T, Arg>,
  arg?: Arg,
): Promise<T> =>
  typeof value === "function"
    ? (value as (a: Arg) => T | Promise<T>)(arg as Arg)
    : value;
