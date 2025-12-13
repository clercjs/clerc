import type { InferFlags, ParsedResult } from "@clerc/parser";

import type { Command } from "./command";
import type { ClercFlagsDefinition } from "./flag";
import type { InferParameters } from "./parameters";

type AddStringIndex<T> = T & Record<string, any>;

type InferFlagsWithGlobal<
	C extends Command,
	GF extends ClercFlagsDefinition,
> = AddStringIndex<
	InferFlags<NonNullable<C["flags"]> & Omit<GF, keyof NonNullable<C["flags"]>>>
>;

export declare interface ContextStore {}

export interface BaseContext<
	C extends Command = Command,
	GF extends ClercFlagsDefinition = {},
> {
	resolved: boolean;
	command?: C;
	calledAs?: string;
	parameters: InferParameters<NonNullable<C["parameters"]>>;
	flags: InferFlagsWithGlobal<C, GF>;
	ignored: string[];
	rawParsed: ParsedResult<InferFlagsWithGlobal<C, GF>>;
	missingParameters: boolean;
	store: Partial<ContextStore>;
}
