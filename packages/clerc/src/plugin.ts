import type { Clerc } from "./cli";

export interface Plugin<T extends Clerc = Clerc, U extends Clerc = Clerc> {
  setup: (cli: T) => U
}

export const definePlugin = <T extends Clerc, U extends Clerc> (p: Plugin<T, U>) => p;
