import type { LiteralUnion, OmitIndexSignature } from "type-fest";
import type { CamelCase, Dict, Equals, MaybeArray } from "@clerc/utils";
import type { Clerc, Root, RootType } from "../cli";
import type { FlagSchema, ParsedFlags, TypeFlag } from "./type-flag";

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

type StripBrackets<Parameter extends string> = (
  Parameter extends `<${infer ParameterName}>` | `[${infer ParameterName}]`
    ? (
        ParameterName extends `${infer SpreadName}...`
          ? SpreadName
          : ParameterName
      )
    : never
);

type ParameterType<Parameter extends string> = (
  Parameter extends `<${infer _ParameterName}...>` | `[${infer _ParameterName}...]`
    ? string[]
    : Parameter extends `<${infer _ParameterName}>`
      ? string
      : Parameter extends `[${infer _ParameterName}]`
        ? string | undefined
        : never
);

export type MakeEventMap<T extends CommandRecord> = { [K in keyof T]: [InspectorContext] };
export type PossibleInputKind = string | number | boolean | Dict<any>;
type NonNullableParameters<T extends string[] | undefined> = T extends undefined ? [] : NonNullable<T>;
type TransformParameters<C extends Command> = {
  [Parameter in NonNullableParameters<C["parameters"]>[number] as CamelCase<StripBrackets<Parameter>>]: ParameterType<Parameter>;
};
type FallbackFlags<C extends Command> = Equals<NonNullableFlag<C>["flags"], {}> extends true ? Dict<any> : NonNullableFlag<C>["flags"];
type NonNullableFlag<C extends Command> = TypeFlag<NonNullable<C["flags"]>>;
type ParseFlag<C extends CommandRecord, N extends keyof C> = N extends keyof C ? OmitIndexSignature<NonNullableFlag<C[N]>["flags"]> : FallbackFlags<C[N]>["flags"];
type ParseRaw<C extends Command> = NonNullableFlag<C> & {
  flags: FallbackFlags<C>
  parameters: string[]
  mergedFlags: FallbackFlags<C> & NonNullableFlag<C>["unknownFlags"]
};
type ParseParameters<C extends CommandRecord = CommandRecord, N extends keyof C = keyof C> =
  Equals<TransformParameters<C[N]>, {}> extends true
    ? N extends keyof C
      ? TransformParameters<C[N]>
      : Dict<string | string[] | undefined>
    : TransformParameters<C[N]>;
export interface HandlerContext<C extends CommandRecord = CommandRecord, N extends keyof C = keyof C> {
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
export type Handler<C extends CommandRecord = CommandRecord, K extends keyof C = keyof C> = (ctx: HandlerContext<C, K>) => void;
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

export interface Plugin<T extends Clerc = Clerc, U extends Clerc = Clerc> {
  setup: (cli: T) => U
}
