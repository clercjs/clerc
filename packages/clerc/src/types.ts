import type { Clerc } from "./cli";

export type Dict<T> = Record<string, T>;
type MustArray<T> = T extends any[] ? T : [T];
export type MaybeArray<T> = T | T[];
type GetLength<T extends any[]> = T extends { length: infer L extends number } ? L : never;
type GetTail<T extends any[]> = T extends [infer _Head, ...infer Tail] ? Tail : never;
type EnhanceSingle<T, E extends Dict<any>> = T & E;
export type Enhance<T, E extends Dict<any> | Dict<any>[]> = GetLength<MustArray<E>> extends 0 ? T : Enhance<EnhanceSingle<T, MustArray<E>[0]>, GetTail<MustArray<E>>>;

export interface FlagOptions {
  alias?: MaybeArray<string>
  default?: MaybeArray<PossibleFlagKind>
  description: string
}
export interface Flag extends FlagOptions {
  name: string
}
export interface CommandOptions {
  alias?: MaybeArray<string>
  flags?: Dict<FlagOptions>
}
export interface Command<N extends string = string, D extends string = string> extends CommandOptions {
  name: N
  description: D
}
export type CommandRecord = Dict<Command>;
export type MakeEventMap<T extends CommandRecord> = { [K in keyof T]: [InvokerContext] };
export type PossibleFlagKind = string | number | boolean | Dict<any>;
export interface HandlerContext<C extends CommandRecord = CommandRecord, N extends keyof C = keyof C> {
  name: N
  parameters: string[]
  flags: Dict<MaybeArray<PossibleFlagKind> | undefined>
  cli: Clerc<C>
}
export type Handler = (ctx: HandlerContext) => void;
export interface InvokerContext<C extends CommandRecord = CommandRecord, N extends keyof C = keyof C> extends HandlerContext<C, N> {}
export type Invoker = (ctx: InvokerContext<any>, next: Invoker) => void;

export type { Plugin } from "./plugin";
