import type { Clerc } from "./cli";

export interface Command<T, F extends FlagRecord = FlagRecord> {
  description: string
  type: T
  aliases?: string[]
  flags?: F
  default?: ExtractType<T>
}

export type InternalCommand<T> = Omit<Command<T>, "default">;

export interface Flag<T> {
  description: string
  type: T
  aliases?: string[]
  default?: ExtractType<T>
}

export type InternalFlag<T> = Omit<Flag<T>, "default">;

export type ToRealCommandOrFlag<C extends InternalCommand<any> | InternalFlag<any>> = C & { default?: ExtractType<C["type"]> };

export type FlagRecord = Record<string, Flag<any>>;
export type CommandRecord = Record<string, Command<any>>;

export type ExtractType<T> =
  T extends String | StringConstructor ? string :
    T extends Number | NumberConstructor ? number :
      T extends Boolean | BooleanConstructor ? boolean :
        T extends (infer U)[] ? ExtractType<U>[] :
          T extends object ? { [K in keyof T]: ExtractType<T[K]> } : T;

export type GetFlags<F extends FlagRecord | undefined> =
  F extends undefined ? undefined :
    // @ts-expect-error OK.
    { [K in keyof F]: ExtractType<F[K]["type"]> };

export type Handler<C extends Command<any>> =
  (value: ExtractType<C["type"]>, flags: GetFlags<C["flags"]>) => void;

export type ConvertToEventMap<C extends Record<string, Command<any>>> = {
  [K in keyof C]: [ExtractType<C[K]["type"]>, GetFlags<C[K]["flags"]>]
};

export type EnhanceCommands<
  C extends CommandRecord,
  Name extends string,
  IComm extends InternalCommand<any>,
> = Name extends keyof C ? Omit<C, Name> & Record<Name, ToRealCommandOrFlag<IComm>> : C & Record<Name, ToRealCommandOrFlag<IComm>>;

export type BaseClerc = Clerc<string, string, Record<string, any>>;

export interface Enhancement {
  commands: CommandRecord
}

export type Middleware<_E extends Enhancement> = (c: BaseClerc) => BaseClerc;

export type GetName<C extends BaseClerc> = C extends Clerc<infer I, any, any> ? I : never;
export type GetDescription<C extends BaseClerc> = C extends Clerc<any, infer I, any> ? I : never;
export type GetCommands<C extends BaseClerc> = C extends Clerc<any, any, infer I> ? I : never;

export type EnhanceEnhancement<C extends BaseClerc, E extends Enhancement> = Clerc<GetName<C>, GetDescription<C>, GetCommands<C> & E["commands"]>;
