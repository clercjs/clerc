import type { Clerc } from "./cli";
import type { Handler, Inspector, Plugin } from "./types";

export const definePlugin = <T extends Clerc, U extends Clerc> (p: Plugin<T, U>) => p;

export const defineHandler = <C extends Clerc, K extends keyof C["_commands"]> (_cli: C, _key: K, handler: Handler<C["_commands"], K>) => handler;

export const defineInspector = <C extends Clerc> (_cli: C, inspector: Inspector<C["_commands"]>) => inspector;
