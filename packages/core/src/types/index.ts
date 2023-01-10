import type { CamelCase, Dict, Equals, LiteralUnion, MaybeArray } from "@clerc/utils";
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
// Custom properties
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
export type CommandRecord = Dict<Command> & { [Root]?: Command };
export type MakeEventMap<T extends CommandRecord> = { [K in keyof T]: [InspectorContext] };
export type PossibleInputKind = string | number | boolean | Dict<any>;
type NonNullableParameters<T extends string[] | undefined> = T extends undefined ? [] : NonNullable<T>;
type TransformParameters<C extends Command> = {
  [Parameter in NonNullableParameters<C["parameters"]>[number] as CamelCase<StripBrackets<Parameter>>]: ParameterType<Parameter>;
};
type TypeFlagWithDefault<C extends Command> = TypeFlag<NonNullable<C["flags"]>>;
type Raw<C extends Command> =
  TypeFlagWithDefault<C> & {
    parameters: string[]
    mergedFlags: TypeFlagWithDefault<C>["flags"] & TypeFlagWithDefault<C>["unknownFlags"]
  };
export interface HandlerContext<C extends CommandRecord = CommandRecord, N extends keyof C = keyof C> {
  name?: LiteralUnion<N, string>
  called?: string | RootType
  resolved: boolean
  hasRootOrAlias: boolean
  hasRoot: boolean
  raw: { [K in keyof Raw<C[N]>]: Raw<C[N]>[K] }
  parameters: Equals<TransformParameters<C[N]>, {}> extends true
    ? N extends keyof C
      ? { [K in keyof TransformParameters<C[N]>]: TransformParameters<C[N]>[K] }
      : Dict<string | string[] | undefined>
    : { [K in keyof TransformParameters<C[N]>]: TransformParameters<C[N]>[K] }
  unknownFlags: ParsedFlags["unknownFlags"]
  flags: Equals<TypeFlagWithDefault<C[N]>["flags"], {}> extends true ? Dict<any> : TypeFlagWithDefault<C[N]>["flags"]
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
