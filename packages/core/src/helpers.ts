import type { Dict, MaybeArray } from "@clerc/utils";
import type { Clerc, SingleCommandType } from "./cli";
import type { Command, CommandOptions, FlagOptions, Handler, HandlerInCommand, Inspector, Plugin } from "./types";

export const definePlugin = <T extends Clerc, U extends Clerc>(p: Plugin<T, U>) => p;

export const defineHandler = <C extends Clerc, K extends keyof C["_commands"]>(_cli: C, _key: K, handler: Handler<C["_commands"], K>) => handler;

export const defineInspector = <C extends Clerc>(_cli: C, inspector: Inspector<C["_commands"]>) => inspector;

export const defineCommand = <N extends string | SingleCommandType, O extends CommandOptions<[...P], A, F>, P extends string[] = string[], A extends MaybeArray<string> = MaybeArray<string>, F extends Dict<FlagOptions> = Dict<FlagOptions>>(
  command: Command<N, O & CommandOptions<[...P], A, F>>,
  handler?: HandlerInCommand<Record<N, Command<N, O>> & Record<PropertyKey, never>, N>,
) => ({ ...command, handler });
