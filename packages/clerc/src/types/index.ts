import { } from "type-flag";

import type { Clerc, SingleCommand, SingleCommandType } from "../cli";
import type { FlagSchema } from "./type-flag";

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

interface ParsedArgs {
  [arg: string]: any
  "--"?: string[] | undefined
  _: string[]
}
export type FlagOptions = FlagSchema & {
  description: string
  required?: boolean
};
export type Flag = FlagOptions & {
  name: string
};
export interface ParameterOptions {
  description: string
  required?: boolean
}
export interface Parameter extends ParameterOptions {
  name: string
}
export interface CommandOptions {
  alias?: MaybeArray<string>
  parameters?: Dict<ParameterOptions>
  flags?: Dict<FlagOptions>
}
export interface Command<N extends string | SingleCommandType = string, D extends string = string> extends CommandOptions {
  name: N
  description: D
}
export type CommandRecord = Dict<Command> & { [SingleCommand]?: Command };
export type MakeEventMap<T extends CommandRecord> = { [K in keyof T]: [InspectorContext] };
export type PossibleInputKind = string | number | boolean | Dict<any>;
export interface HandlerContext<C extends CommandRecord = CommandRecord, N extends keyof C = keyof C> {
  name?: N
  resolved: boolean
  isSingleCommand: boolean
  raw: ParsedArgs
  parameters: PossibleInputKind[]
  flags: Dict<MaybeArray<PossibleInputKind> | undefined>
  cli: Clerc<C>
}
export type Handler<C extends Clerc = Clerc> = (ctx: HandlerContext<C["_commands"]>) => void;
export interface InspectorContext<C extends CommandRecord = CommandRecord, N extends keyof C = keyof C> extends HandlerContext<C, N> {}
export type Inspector = (ctx: InspectorContext<any>, next: () => void) => void;

export type { Plugin } from "../plugin";
