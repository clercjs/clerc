import type { FlagOptions, FlagType } from "@clerc/parser";

export declare interface FlagCustomOptions {}

export type ClercFlagOptions = FlagOptions & FlagCustomOptions;

export type ClercGlobalFlagDefinitionValue = ClercFlagOptions | FlagType;

export type ClercFlagOptionsWithDescription = ClercFlagOptions & {
	description: string;
};
export type ClercFlagsDefinition = Record<
	string,
	ClercFlagOptionsWithDescription
>;
