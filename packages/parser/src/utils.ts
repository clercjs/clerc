import type { FlagOptions, TypeValue } from "./types";

export const isArrayOfType = (arr: unknown, type: unknown): boolean =>
  Array.isArray(arr) && arr[0] === type;

export function inferDefault(type: TypeValue): unknown {
  if (Array.isArray(type)) {
    return type[0] === Boolean ? 0 : [];
  }
  if (type === Boolean) {
    return false;
  }
  if (type === Object) {
    return {};
  }

  return undefined;
}

export const isLetter = (charCode: number): boolean =>
  (charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122);

export const isDigit = (charCode: number): boolean =>
  charCode >= 48 && charCode <= 57;

export function setValueByType(
  flags: any,
  key: string,
  value: string,
  config: FlagOptions,
): void {
  const { type } = config;
  if (Array.isArray(type)) {
    if (type[0] === Boolean) {
      flags[key] = (flags[key] ?? 0) + 1;
    } else {
      (flags[key] ??= []).push(type[0](value));
    }
  } else {
    flags[key] = (type as (value: string) => unknown)(value);
  }
}

export function coerceObjectValue(value: string): string | boolean {
  if (value === "true" || value === "") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  return value;
}

export function appendDotValues(obj: any, path: string, value: any): void {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (
      Object.hasOwn(current, key) &&
      (typeof current[key] !== "object" || current[key] === null)
    ) {
      return;
    }
    current[key] ??= {};
    current = current[key];
  }
  const lastKey = keys.at(-1)!;

  if (Object.hasOwn(current, lastKey)) {
    const existing = current[lastKey];
    current[lastKey] = Array.isArray(existing)
      ? [...existing, value]
      : [existing, value];
  } else {
    current[lastKey] = value;
  }
}

export function splitNameAndValue(
  arg: string,
  delimiters: readonly string[],
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

  if (sepIdx === -1) {
    return { rawName: arg, rawValue: undefined, hasSep: false };
  }

  return {
    rawName: arg.slice(0, sepIdx),
    rawValue: arg.slice(sepIdx + delimiterLen),
    hasSep: true,
  };
}
