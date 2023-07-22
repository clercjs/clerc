import type { CamelCase, Dict, Equals } from "@clerc/utils";
import type { OmitIndexSignature } from "type-fest";

import type { TypeFlag } from "./type-flag";
import type {
	Command,
	Commands,
	Flags,
	GlobalFlagOptions,
	InspectorContext,
} from ".";

type StripBrackets<Parameter extends string> = Parameter extends
	| `<${infer ParameterName}>`
	| `[${infer ParameterName}]`
	? ParameterName extends `${infer SpreadName}...`
		? SpreadName
		: ParameterName
	: never;

type ParameterType<Parameter extends string> = Parameter extends
	| `<${infer _ParameterName}...>`
	| `[${infer _ParameterName}...]`
	? string[]
	: Parameter extends `<${infer _ParameterName}>`
	? string
	: Parameter extends `[${infer _ParameterName}]`
	? string | undefined
	: never;

type NonNullableParameters<T extends string[] | undefined> = T extends undefined
	? []
	: NonNullable<T>;
export type TransformParameters<C extends Command> = {
	[Parameter in NonNullableParameters<C["parameters"]>[number] as CamelCase<
		StripBrackets<Parameter>
	>]: ParameterType<Parameter>;
};

export type MakeEventMap<T extends Commands> = {
	[K in keyof T]: [InspectorContext];
};

type FallbackFlags<F extends Flags | undefined> = Equals<
	NonNullableFlag<F>["flags"],
	{}
> extends true
	? Dict<any>
	: NonNullableFlag<F>["flags"];
type NonNullableFlag<F extends Flags | undefined> = TypeFlag<NonNullable<F>>;
export type ParseFlag<
	C extends Commands,
	N extends keyof C,
	GF extends GlobalFlagOptions = {},
> = N extends keyof C
	? OmitIndexSignature<NonNullableFlag<C[N]["flags"] & GF>["flags"]>
	: FallbackFlags<C[N]["flags"] & GF>["flags"];
export type ParseRaw<
	C extends Command,
	GF extends GlobalFlagOptions = {},
> = NonNullableFlag<C["flags"] & GF> & {
	flags: FallbackFlags<C["flags"] & GF>;
	parameters: string[];
	mergedFlags: FallbackFlags<C["flags"] & GF> &
		NonNullableFlag<C["flags"] & GF>["unknownFlags"];
};
export type ParseParameters<
	C extends Commands = Commands,
	N extends keyof C = keyof C,
> = Equals<TransformParameters<C[N]>, {}> extends true
	? N extends keyof C
		? TransformParameters<C[N]>
		: Dict<string | string[] | undefined>
	: TransformParameters<C[N]>;
