import type { MaybeArray, MaybeGetter } from "./types";

export const looseIsArray = <T>(arr: any): arr is readonly T[] =>
  Array.isArray(arr);

export type * from "./types";

export const toArray = <T>(a: MaybeArray<T>): T[] =>
  Array.isArray(a) ? a : [a];

const camelCaseCache = new Map<string, string>();

/**
 * Converts a dash- or space-separated string to camelCase.
 *
 * Not using regexp for better performance, because this function is used in
 * parser.
 */
export function camelCase(str: string): string {
  const cached = camelCaseCache.get(str);
  if (cached !== undefined) {
    return cached;
  }

  // Find first separator using charCode for performance
  const len = str.length;
  let firstIdx = -1;
  for (let i = 0; i < len; i++) {
    const c = str.charCodeAt(i);
    // 45 = '-', 32 = ' '
    if (c === 45 || c === 32) {
      firstIdx = i;
      break;
    }
  }

  if (firstIdx === -1) {
    // Cache even when no transformation needed
    camelCaseCache.set(str, str);

    return str;
  }

  let result = str.slice(0, firstIdx);
  for (let i = firstIdx; i < len; i++) {
    const c = str.charCodeAt(i);
    // 45 = '-', 32 = ' '
    if ((c === 45 || c === 32) && i + 1 < len) {
      const nextChar = str.charCodeAt(i + 1);
      // 97-122 = a-z
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

export function joinWithAnd(values: string[]): string {
  if (values.length === 0) {
    return "";
  }
  if (values.length === 1) {
    return values[0];
  }

  const last = values.pop();

  return `${values.join(", ")} and ${last}`;
}

export const kebabCase = <T extends string>(s: T): string =>
  s.replace(/([A-Z])/g, (_, c) => `-${c.toLowerCase()}`);

export const formatFlagName = (n: string): string =>
  n.length <= 1 ? `-${n}` : `--${kebabCase(n)}`;

export const formatVersion = (v: string): string =>
  v.length === 0 ? "" : v.startsWith("v") ? v : `v${v}`;

export const isTruthy: <T>(
  item: T,
) => item is Exclude<T, false | null | undefined> = Boolean as any;

export const objectIsEmpty = (obj: Record<string, any>): boolean =>
  Object.keys(obj).length === 0;

export const resolveValue = <T>(value: MaybeGetter<T>): T =>
  typeof value === "function" ? (value as () => T)() : value;

export const hasOwn = (obj: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);
