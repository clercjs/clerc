import type { CamelCase, Dict, MaybeArray } from "@clerc/utils";
import type { Clerc, SingleCommand, SingleCommandType } from "../cli";
import type { FlagSchema, ParsedFlags, TypeFlag } from "./type-flag";

export type CommandType = SingleCommandType | string;
export type FlagOptions = FlagSchema & {
  description?: string
};
export type Flag = FlagOptions & {
  name: string
};
// Custom properties
export declare interface CommandCustomProperties {}
export interface CommandOptions<P extends string[] = string[], A extends MaybeArray<string> = MaybeArray<string>, F extends Dict<FlagOptions> = Dict<FlagOptions>> extends CommandCustomProperties {
  alias?: A
  parameters?: P
  flags?: F
  examples?: [string, string][]
  notes?: string[]
}
export type Command<N extends string | SingleCommandType = string, O extends CommandOptions = CommandOptions> = O & {
  name: N
  description: string
};
export type CommandAlias<N extends string | SingleCommandType = string, O extends CommandOptions = CommandOptions> = Command<N, O> & {
  __isAlias?: true
};
export type CommandWithHandler<N extends string | SingleCommandType = string, O extends CommandOptions = CommandOptions> = Command<N, O> & {
  handler?: HandlerInCommand<Record<N, Command<N, O>> & Record<never, never>, N>
};
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
export type CommandRecord = Dict<Command> & { [SingleCommand]?: Command };
export type MakeEventMap<T extends CommandRecord> = { [K in keyof T]: [InspectorContext] };
export type PossibleInputKind = string | number | boolean | Dict<any>;
type NonNullableParameters<T extends string[] | undefined> = T extends undefined ? [] : NonNullable<T>;
type TransformParameters<C extends CommandRecord = CommandRecord, N extends keyof C = keyof C> = {
  [Parameter in [...NonNullableParameters<C[N]["parameters"]>][number] as CamelCase<StripBrackets<Parameter>>]: ParameterType<Parameter>;
};
type TransformFlags<F extends Record<string, FlagSchema>> = {
  [K in keyof F]: F[K]["type"] extends any[]
    ? F[K]["default"] extends never[]
      ? F[K] & { default: any[] }
      : F[K]
    : F[K]
};
type TypeFlagWithDefault<C extends CommandRecord = CommandRecord, N extends keyof C = keyof C> = [C[N]] extends [unknown] ? { flags: Dict<any>; unknownFlags: Dict<any> } : TypeFlag<TransformFlags<NonNullable<C[N]["flags"]>>>;
type Raw<C extends CommandRecord = CommandRecord, N extends keyof C = keyof C> =
  TypeFlagWithDefault<C, N> & {
    parameters: string[]
    mergedFlags: TypeFlagWithDefault<C, N>["flags"] & TypeFlagWithDefault<C, N>["unknownFlags"]
  };
export interface HandlerContext<C extends CommandRecord = CommandRecord, N extends keyof C = keyof C> {
  name: N extends keyof C ? N : N | undefined
  resolved: N extends keyof C ? true : boolean
  isSingleCommand: boolean
  raw: Raw<C, N>
  parameters: TransformParameters<C, N>
  unknownFlags: ParsedFlags["unknownFlags"]
  flags: TypeFlagWithDefault<C, N>["flags"]
  cli: Clerc<C>
}
export type Handler<C extends CommandRecord = CommandRecord, K extends keyof C = keyof C> = (ctx: HandlerContext<C, K>) => void;
export type HandlerInCommand<C extends CommandRecord = CommandRecord, K extends keyof C = keyof C> = (ctx: HandlerContext<C, K> & { name: K }) => void;
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
