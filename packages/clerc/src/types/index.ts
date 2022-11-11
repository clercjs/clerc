import type { Clerc, SingleCommand, SingleCommandType } from "../cli";
import type { FlagSchema, ParsedFlags, TypeFlag } from "./type-flag";

/**
 * Copied from type-fest
 */
export type Primitive =
  | null
  | undefined
  | string
  | number
  | boolean
  | symbol
  | bigint;
/**
 * Copied from type-fest
 */
export type LiteralUnion<
  LiteralType,
  BaseType extends Primitive,
> = LiteralType | (BaseType & Record<never, never>);
export type Dict<T> = Record<string, T>;
type MustArray<T> = T extends any[] ? T : [T];
export type MaybeArray<T> = T | T[];
type GetLength<T extends any[]> = T extends { length: infer L extends number } ? L : never;
type GetTail<T extends any[]> = T extends [infer _Head, ...infer Tail] ? Tail : never;
type EnhanceSingle<T, E extends Dict<any>> = T & E;
export type Enhance<T, E extends Dict<any> | Dict<any>[]> = GetLength<MustArray<E>> extends 0 ? T : Enhance<EnhanceSingle<T, MustArray<E>[0]>, GetTail<MustArray<E>>>;

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
export interface CommandOptions<A extends MaybeArray<string> = MaybeArray<string>, F extends Dict<FlagOptions> = Dict<FlagOptions>> {
  alias?: A
  // parameters?: P
  flags?: F
}
export type Command<N extends string | SingleCommandType = string, D extends string = string, Options extends CommandOptions = CommandOptions> = Options & {
  name: N
  description: D
};
export type CommandRecord = Dict<Command> & { [SingleCommand]?: Command };
export type MakeEventMap<T extends CommandRecord> = { [K in keyof T]: [InspectorContext] };
export type PossibleInputKind = string | number | boolean | Dict<any>;
type NonNullableFlag<T extends Dict<FlagOptions> | undefined> = T extends undefined ? {} : NonNullable<T>;
export interface HandlerContext<C extends CommandRecord = CommandRecord, N extends keyof C = keyof C> {
  name?: N
  resolved: boolean
  isSingleCommand: boolean
  raw: ParsedFlags
  parameters: PossibleInputKind[]
  flags: TypeFlag<NonNullableFlag<C[N]["flags"]>>["flags"]
  cli: Clerc<C>
}
export type Handler<C extends CommandRecord = CommandRecord, K extends keyof C = keyof C> = (ctx: HandlerContext<C, K>) => void;
export type InspectorContext<C extends CommandRecord = CommandRecord> = HandlerContext<C> & {
  flags: {} extends TypeFlag<NonNullableFlag<C[keyof C]["flags"]>>["flags"] ? Dict<any> : TypeFlag<NonNullableFlag<C[keyof C]["flags"]>>["flags"]
};
export type Inspector<C extends CommandRecord = CommandRecord> = (ctx: InspectorContext<C>, next: () => void) => void;

export interface Plugin<T extends Clerc = Clerc, U extends Clerc = Clerc> {
  setup: (cli: T) => U
}
