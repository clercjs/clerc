import type { FlagOptions, TypeValue } from "@clerc/parser";

export declare interface FlagCustomOptions {}

export type ClercFlagOptions = FlagOptions & {
	description?: string;
} & FlagCustomOptions;

export type ClercFlagDefinitionValue = ClercFlagOptions | TypeValue;

export type ClercFlagsDefinition = Record<string, ClercFlagDefinitionValue>;
