import type { LiteralUnion } from "type-fest";
import type { Dict, MaybeArray } from "@clerc/utils";
import type { Clerc, Root, RootType } from "../cli";
import type { FlagSchema, ParsedFlags, TypeFlag } from "./type-flag";
import type { ParseFlag, ParseParameters, ParseRaw } from "./utils";

export type CommandType = RootType | string;

export type FlagOptions = FlagSchema & {
  description?: string
};
export type Flag = FlagOptions & {
  name: string
};
export type Flags = Dict<FlagOptions>;

export declare interface CommandCustomProperties {}
export interface CommandOptions<P extends string[] = string[], A extends MaybeArray<string | RootType> = MaybeArray<string | RootType>, F extends Flags = Flags> extends CommandCustomProperties {
  alias?: A
  parameters?: P
  flags?: F
  examples?: [string, string][]
  notes?: string[]
}
export type Command<N extends string | RootType = string, O extends CommandOptions = CommandOptions> = O & {
  name: N
  description: string
};
export type CommandAlias<N extends string | RootType = string, O extends CommandOptions = CommandOptions> = Command<N, O> & {
  __isAlias?: true
};
export type CommandWithHandler<N extends string | RootType = string, O extends CommandOptions = CommandOptions> = Command<N, O> & { handler?: HandlerInCommand<HandlerContext<Record<N, Command<N, O>> & Record<never, never>, N>> };
export type Commands = Dict<Command> & { [Root]?: Command };

export interface ParseOptions {
  argv?: string[]
  run?: boolean
}

export interface HandlerContext<C extends Commands = Commands, N extends keyof C = keyof C> {
  name?: LiteralUnion<N, string>
  called?: string | RootType
  resolved: boolean
  hasRootOrAlias: boolean
  hasRoot: boolean
  raw: { [K in keyof ParseRaw<C[N]>]: ParseRaw<C[N]>[K] }
  parameters: { [K in keyof ParseParameters<C, N>]: ParseParameters<C, N>[K] }
  unknownFlags: ParsedFlags["unknownFlags"]
  flags: { [K in keyof ParseFlag<C, N>]: ParseFlag<C, N>[K] }
  cli: Clerc<C>
}
export type Handler<C extends Commands = Commands, K extends keyof C = keyof C> = (ctx: HandlerContext<C, K>) => void;
export type HandlerInCommand<C extends HandlerContext> = (ctx: { [K in keyof C]: C[K] }) => void;
export type FallbackType<T, U> = {} extends T ? U : T;
export type InspectorContext<C extends Commands = Commands> = HandlerContext<C> & {
  flags: FallbackType<TypeFlag<NonNullable<C[keyof C]["flags"]>>["flags"], Dict<any>>
};
export type Inspector<C extends Commands = Commands> = InspectorFn<C> | InspectorObject<C>;
export type InspectorFn<C extends Commands = Commands> = (ctx: InspectorContext<C>, next: () => void) => (() => void) | void;
export interface InspectorObject<C extends Commands = Commands> {
  enforce?: "pre" | "post"
  fn: InspectorFn<C>
}

export type { MakeEventMap } from "./utils";
export type { Plugin } from "./plugin";
export * from "./i18n";
