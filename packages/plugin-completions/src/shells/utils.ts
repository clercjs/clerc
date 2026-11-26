import type { StaticNodeSpec } from "../spec";

export const shQuote = (value: string): string =>
  `'${value.replace(/'/g, "'\\''")}'`;

export const fishQuote = (value: string): string =>
  `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

export const psQuote = (value: string): string =>
  `'${value.replace(/'/g, "''")}'`;

export const digitShortChars = (node: StaticNodeSpec): string =>
  node.flags
    .map((f) => f.short)
    .filter((s): s is string => s !== undefined && s >= "0" && s <= "9")
    .join("");

export function shortStartPattern(node: StaticNodeSpec): string {
  const digits = digitShortChars(node);

  return digits ? `^(--|-[A-Za-z${digits}])` : "^(--|-[A-Za-z])";
}
