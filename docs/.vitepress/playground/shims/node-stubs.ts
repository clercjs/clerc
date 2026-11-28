import * as clack from "./clack.ts";

// node:tty
export class WriteStream {
  public hasColors(): boolean {
    return true;
  }
}

// node:readline
export function createInterface(): never {
  throw new Error("stdio readline is not supported in browser preview");
}

// node:fs/promises
function unsupportedFs(): never {
  throw new Error("Filesystem operations are not supported in browser preview");
}

export const mkdir = unsupportedFs;
export const readFile = unsupportedFs;
export const rm = unsupportedFs;
export const writeFile = unsupportedFs;

// node:os
export const homedir = (): string => "/home/demo";

// node:path
export const join = (...parts: string[]): string =>
  parts
    .filter(Boolean)
    .join("/")
    .replace(/\/{2,}/g, "/");

export function dirname(p: string): string {
  const idx = p.lastIndexOf("/");

  return idx <= 0 ? "/" : p.slice(0, idx);
}

// node:module
export const createRequire =
  () =>
  (specifier: string): unknown => {
    if (specifier === "@clack/prompts") {
      return clack;
    }

    throw new Error(`Dynamic require not supported in browser: ${specifier}`);
  };
