import type { Clerc } from "./cli";

export interface Plugin<U, T extends Clerc = Clerc> {
  setup: (cli: T) => U
}

export function definePlugin<T extends Clerc, U extends Clerc> (p: Plugin<T, U>): Plugin<T, U> {
  return p;
}
