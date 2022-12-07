import type { CamelCase, Dict, MaybeArray } from "@clerc/utils";
import type { Clerc, SingleCommand, SingleCommandType } from "../cli";
import type { FlagSchema, ParsedFlags, TypeFlag } from "./type-flag";

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
  handler?: HandlerInCommand<
    // @ts-expect-error That's OK
    Record<N, Command<N, O>>, N
  >
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
type NonNullableFlag<T extends Dict<FlagOptions> | undefined> = T extends undefined ? {} : NonNullable<T>;
type NonNullableParameters<T extends string[] | undefined> = T extends undefined ? [] : NonNullable<T>;
export interface HandlerContext<C extends CommandRecord = CommandRecord, N extends keyof C = keyof C> {
  name?: N
  resolved: boolean
  isSingleCommand: boolean
  raw: TypeFlag<NonNullableFlag<C[N]["flags"]>> & { parameters: string[] }
  parameters: {
    [Parameter in [...NonNullableParameters<C[N]["parameters"]>][number] as CamelCase<StripBrackets<Parameter>>]: ParameterType<Parameter>;
  }
  unknownFlags: ParsedFlags["unknownFlags"]
  flags: TypeFlag<NonNullableFlag<C[N]["flags"]>>["flags"]
  cli: Clerc<C>
}
export type Handler<C extends CommandRecord = CommandRecord, K extends keyof C = keyof C> = (ctx: HandlerContext<C, K>) => void;
export type HandlerInCommand<C extends CommandRecord = CommandRecord, K extends keyof C = keyof C> = (ctx: HandlerContext<C, K> & { name: K }) => void;
export type FallbackType<T, U> = {} extends T ? U : T;
export type InspectorContext<C extends CommandRecord = CommandRecord> = HandlerContext<C> & {
  flags: FallbackType<TypeFlag<NonNullableFlag<C[keyof C]["flags"]>>["flags"], Dict<any>>
};
export type Inspector<C extends CommandRecord = CommandRecord> = (ctx: InspectorContext<C>, next: () => void) => void;

export interface Plugin<T extends Clerc = Clerc, U extends Clerc = Clerc> {
  setup: (cli: T) => U
}
