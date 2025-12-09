import type { FlagOptions, FlagType } from "@clerc/parser";

export type ClercFlagOptions = FlagOptions & {
	description: string;
};
export type ClercFlagDefinitionValue = ClercFlagOptions | FlagType;
export type ClercFlagsDefinition = Record<string, ClercFlagDefinitionValue>;
