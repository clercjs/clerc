import type { FlagOptions, FlagType } from "@clerc/parser";

export type ClercFlagOptions = FlagOptions & {
	description?: string;
};
export type ClercFlagDefinitionValue = ClercFlagOptions | FlagType;
export type ClercFlagsDefinition = Record<string, ClercFlagDefinitionValue>;

export interface CommandOptions<Parameters extends string[] = string[]> {
	parameters?: Parameters;
	flags?: ClercFlagsDefinition;
}

export interface Command<
	Parameters extends string[] = string[],
> extends CommandOptions<Parameters> {
	name: string;
	description: string;
}
