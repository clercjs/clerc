import type { Clerc } from "./cli";

export interface Plugin<R, T extends Clerc = Clerc> {
  setup: (cli: T) => R
}

export const definePlugin = <T extends Clerc, R extends Clerc> (p: Plugin<R, T>) => p;
