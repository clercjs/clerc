import type { FlagOptions, FlagType } from "@clerc/parser";

export declare interface FlagCustomOptions {}

export type ClercFlagOptions = FlagOptions & {
	description?: string;
} & FlagCustomOptions;

export type ClercFlagDefinitionValue = ClercFlagOptions | FlagType;

export type ClercFlagsDefinition = Record<string, ClercFlagDefinitionValue>;
