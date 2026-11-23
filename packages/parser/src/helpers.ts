export type MaybeGetter<T> = T | (() => T);

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type IsAny<T> = 0 extends 1 & T ? true : false;

export type RequireExactlyOneOrNone<T, Keys extends keyof T = keyof T> =
  | ({
      [K in Keys]-?: Required<Pick<T, K>> &
        Partial<Record<Exclude<Keys, K>, never>>;
    }[Keys] &
      Omit<T, Keys>)
  | (Partial<Record<Keys, never>> & Omit<T, Keys>);

export const resolveValue = <T>(value: MaybeGetter<T>): T =>
  typeof value === "function" ? (value as () => T)() : value;

export const camelCase = (str: string): string =>
  str.includes("-") || str.includes(" ")
    ? str.replace(/[- ](.?)/g, (_, ch: string) => ch.toUpperCase())
    : str;

export const kebabCase = (str: string): string =>
  str.replace(/([A-Z])/g, (_, ch: string) => `-${ch.toLowerCase()}`);
