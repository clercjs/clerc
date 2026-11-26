import type { StaticCandidate } from "../spec";

export const shQuote = (value: string): string =>
  `'${value.replace(/'/g, "'\\''")}'`;

export const fishQuote = (value: string): string =>
  `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

export const psQuote = (value: string): string =>
  `'${value.replace(/'/g, "''")}'`;

export const formatCandidateLine = (item: StaticCandidate): string =>
  item.description ? `${item.value}\t${item.description}` : item.value;
