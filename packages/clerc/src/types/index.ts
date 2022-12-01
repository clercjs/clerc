import type { CamelCase, Dict, MaybeArray } from "@clerc/utils";
import type { Clerc, SingleCommand, SingleCommandType } from "../cli";
import type { FlagSchema, ParsedFlags, TypeFlag } from "./type-flag";

export type FlagOptions = FlagSchema & {
  description: string
  required?: boolean
};
export type Flag = FlagOptions & {
  name: string
};
// export interface ParameterOptions {
//   description: string
//   required?: boolean
// }
// export interface Parameter extends ParameterOptions {
//   name: string
// }
export interface CommandOptions<A extends MaybeArray<string> = MaybeArray<string>, P extends string[] = string[], F extends Dict<FlagOptions> = Dict<FlagOptions>> {
  alias?: A
  parameters?: P
  flags?: F
  examples?: [string, string][]
  notes?: string[]
}
export type Command<N extends string | SingleCommandType = string, D extends string = string, Options extends CommandOptions = CommandOptions> = Options & {
  name: N
  description: D
};
type StripBrackets<Parameter> = (
  Parameter extends `<${infer ParameterName}>` | `[${infer ParameterName}]`
    ? (
        ParameterName extends `${infer SpreadName}...`
          ? SpreadName
          : ParameterName
      )
    : never
);

type ParameterType<Parameter> = (
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
export interface HandlerContext<C extends CommandRecord = CommandRecord, N extends keyof C = keyof C> {
  name?: N
  resolved: boolean
  isSingleCommand: boolean
  raw: ParsedFlags
  parameters: {
    [Parameter in C[N]["parameters"][keyof C[N]["parameters"]] as CamelCase<StripBrackets<Parameter>>]: ParameterType<Parameter>;
  }
  unknownFlags: ParsedFlags["unknownFlags"]
  flags: TypeFlag<NonNullableFlag<C[N]["flags"]>>["flags"]
  cli: Clerc<C>
}
export type Handler<C extends CommandRecord = CommandRecord, K extends keyof C = keyof C> = (ctx: HandlerContext<C, K>) => void;
export type FallbackType<T, U> = {} extends T ? U : T;
export type InspectorContext<C extends CommandRecord = CommandRecord> = HandlerContext<C> & {
  flags: FallbackType<TypeFlag<NonNullableFlag<C[keyof C]["flags"]>>["flags"], Dict<any>>
};
export type Inspector<C extends CommandRecord = CommandRecord> = (ctx: InspectorContext<C>, next: () => void) => void;

export interface Plugin<T extends Clerc = Clerc, U extends Clerc = Clerc> {
  setup: (cli: T) => U
}
