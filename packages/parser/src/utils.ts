import { looseIsArray } from "@clerc/utils";

import type { FlagOptions } from "./types";

export const isArrayOfType = (arr: any, type: any): boolean =>
  Array.isArray(arr) && arr[0] === type;

/**
 * Check if it's a letter (a-z: 97-122, A-Z: 65-90)
 */
export const isLetter = (charCode: number): boolean =>
  (charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122);

/**
 * Check if it's a digit (0-9: 48-57)
 */
export const isDigit = (charCode: number): boolean =>
  charCode >= 48 && charCode <= 57;

export function setValueByType(
  flags: any,
  key: string,
  value: string,
  config: FlagOptions,
): void {
  const { type } = config;
  if (looseIsArray(type)) {
    if (isArrayOfType(type, Boolean)) {
      flags[key] = (flags[key] ?? 0) + 1;
    } else {
      (flags[key] ??= []).push(type[0](value));
    }
  } else {
    flags[key] = type(value);
  }
}

/**
 * Default value coercion for Object type. Converts "true"/"" to true, "false"
 * to false, other values remain unchanged.
 *
 * @param value The raw string value from CLI
 * @returns Coerced value (boolean or string)
 */
export function coerceObjectValue(value: string): string | boolean {
  if (value === "true" || value === "") {
    return true;
  } else if (value === "false") {
    return false;
  }

  return value;
}

/**
 * Sets a value at a nested path in an object, creating intermediate objects as
 * needed. Does NOT apply type conversion - value is set as-is. Overwrites
 * existing values.
 *
 * @param obj The target object
 * @param path Dot-separated path (e.g., "foo.bar.baz")
 * @param value The value to set (used as-is, no type conversion)
 */
export function setDotValues(obj: any, path: string, value: any): void {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    current[key] ??= {};
    current = current[key];
  }
  const lastKey = keys[keys.length - 1];
  current[lastKey] = value;
}

/**
 * Similar to setDotValues but handles duplicate keys by converting to arrays.
 * Does NOT apply type conversion - value is set as-is. Useful for flags that
 * can be specified multiple times.
 *
 * @param obj The target object
 * @param path Dot-separated path (e.g., "foo.bar")
 * @param value The value to set or append (used as-is, no type conversion)
 */
export function appendDotValues(obj: any, path: string, value: any): void {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    current[key] ??= {};
    current = current[key];
  }
  const lastKey = keys[keys.length - 1];

  // Handle duplicate keys by converting to array
  if (lastKey in current) {
    const existing = current[lastKey];
    if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      current[lastKey] = [existing, value];
    }
  } else {
    current[lastKey] = value;
  }
}

export function splitNameAndValue(
  arg: string,
  delimiters: string[],
): {
  rawName: string;
  rawValue: string | undefined;
  hasSep: boolean;
} {
  let sepIdx = -1;
  let delimiterLen = 0;

  for (const delimiter of delimiters) {
    const idx = arg.indexOf(delimiter);
    if (idx !== -1 && (sepIdx === -1 || idx < sepIdx)) {
      sepIdx = idx;
      delimiterLen = delimiter.length;
    }
  }

  const hasSep = sepIdx !== -1;
  if (!hasSep) {
    return { rawName: arg, rawValue: undefined, hasSep: false };
  }

  return {
    rawName: arg.slice(0, sepIdx),
    rawValue: arg.slice(sepIdx + delimiterLen),
    hasSep: true,
  };
}
