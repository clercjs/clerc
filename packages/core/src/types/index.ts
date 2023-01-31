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
export type CommandWithHandler<N extends string | RootType = string, O extends CommandOptions = CommandOptions> = Command<N, O> & { handler?: HandlerInCommand<
  HandlerContext<Record<N, Command<N, O>> & Record<never, never>, N>
> };
export type CommandRecord = Dict<Command> & { [Root]?: Command };

export interface ParseOptions {
  argv?: string[]
  run?: boolean
}

export type PossibleInputKind = string | number | boolean | Dict<any>;

export interface HandlerContext<C extends CommandRecord = CommandRecord, N extends keyof C = keyof C, GF extends Flags = {}> {
  name?: LiteralUnion<N, string>
  called?: string | RootType
  resolved: boolean
  hasRootOrAlias: boolean
  hasRoot: boolean
  raw: { [K in keyof ParseRaw<C[N], GF>]: ParseRaw<C[N], GF>[K] }
  parameters: { [K in keyof ParseParameters<C, N>]: ParseParameters<C, N>[K] }
  unknownFlags: ParsedFlags["unknownFlags"]
  flags: { [K in keyof ParseFlag<C, N, GF>]: ParseFlag<C, N, GF>[K] }
  cli: Clerc<C>
}
export type Handler<C extends CommandRecord = CommandRecord, K extends keyof C = keyof C, GF extends Flags = {}> = (ctx: HandlerContext<C, K, GF>) => void;
export type HandlerInCommand<C extends HandlerContext> = (ctx: { [K in keyof C]: C[K] }) => void;
export type FallbackType<T, U> = {} extends T ? U : T;
export type InspectorContext<C extends CommandRecord = CommandRecord> = HandlerContext<C> & {
  flags: FallbackType<TypeFlag<NonNullable<C[keyof C]["flags"]>>["flags"], Dict<any>>
};
export type Inspector<C extends CommandRecord = CommandRecord> = InspectorFn<C> | InspectorObject<C>;
export type InspectorFn<C extends CommandRecord = CommandRecord> = (ctx: InspectorContext<C>, next: () => void) => void;
export interface InspectorObject<C extends CommandRecord = CommandRecord> {
  enforce?: "pre" | "post"
  fn: InspectorFn<C>
}

export type { MakeEventMap } from "./utils";
export type { Plugin } from "./plugin";
export * from "./i18n";
