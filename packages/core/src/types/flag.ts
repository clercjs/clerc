import type { FlagOptions } from "@clerc/parser";

export type ClercFlagOptions = FlagOptions & {
	description: string;
};
export type ClercFlagsDefinition = Record<string, ClercFlagOptions>;
