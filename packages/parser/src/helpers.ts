export type MaybeGetter<T> = T | (() => T);

export type PartialRequired<T, K extends keyof T> = T & {
  [P in K]-?: T[P];
};

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

export const looseIsArray = <T>(arr: any): arr is readonly T[] =>
  Array.isArray(arr);

export const resolveValue = <T>(value: MaybeGetter<T>): T =>
  typeof value === "function" ? (value as () => T)() : value;

const camelCaseCache = new Map<string, string>();

/**
 * Converts a dash- or space-separated string to camelCase. Uses charCode
 * scanning with memoization for hot-path parser performance.
 */
export function camelCase(str: string): string {
  const cached = camelCaseCache.get(str);
  if (cached !== undefined) {
    return cached;
  }

  const len = str.length;
  let firstIdx = -1;
  for (let i = 0; i < len; i++) {
    const c = str.charCodeAt(i);
    if (c === 45 || c === 32) {
      firstIdx = i;

      break;
    }
  }

  if (firstIdx === -1) {
    camelCaseCache.set(str, str);

    return str;
  }

  let result = str.slice(0, firstIdx);
  for (let i = firstIdx; i < len; i++) {
    const c = str.charCodeAt(i);
    if ((c === 45 || c === 32) && i + 1 < len) {
      const nextChar = str.charCodeAt(i + 1);
      if (nextChar >= 97 && nextChar <= 122) {
        result += String.fromCharCode(nextChar - 32);
        i++;
      } else {
        result += str[i + 1];
        i++;
      }
    } else if (c !== 45 && c !== 32) {
      result += str[i];
    }
  }

  camelCaseCache.set(str, result);

  return result;
}
