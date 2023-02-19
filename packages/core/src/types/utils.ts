import type { CamelCase, Dict, Equals } from "@clerc/utils";
import type { OmitIndexSignature } from "type-fest";
import type { TypeFlag } from "./type-flag";
import type { Command, Commands, InspectorContext } from ".";

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

type NonNullableParameters<T extends string[] | undefined> = T extends undefined ? [] : NonNullable<T>;
export type TransformParameters<C extends Command> = {
  [Parameter in NonNullableParameters<C["parameters"]>[number] as CamelCase<StripBrackets<Parameter>>]: ParameterType<Parameter>;
};

export type MakeEventMap<T extends Commands> = { [K in keyof T]: [InspectorContext] };

type FallbackFlags<C extends Command> = Equals<NonNullableFlag<C>["flags"], {}> extends true ? Dict<any> : NonNullableFlag<C>["flags"];
type NonNullableFlag<C extends Command> = TypeFlag<NonNullable<C["flags"]>>;
export type ParseFlag<C extends Commands, N extends keyof C> = N extends keyof C ? OmitIndexSignature<NonNullableFlag<C[N]>["flags"]> : FallbackFlags<C[N]>["flags"];
export type ParseRaw<C extends Command> = NonNullableFlag<C> & {
  flags: FallbackFlags<C>
  parameters: string[]
  mergedFlags: FallbackFlags<C> & NonNullableFlag<C>["unknownFlags"]
};
export type ParseParameters<C extends Commands = Commands, N extends keyof C = keyof C> =
  Equals<TransformParameters<C[N]>, {}> extends true
    ? N extends keyof C
      ? TransformParameters<C[N]>
      : Dict<string | string[] | undefined>
    : TransformParameters<C[N]>;
