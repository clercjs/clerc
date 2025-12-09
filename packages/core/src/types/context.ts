import type { InferFlags, ParsedResult } from "@clerc/parser";

import type { Command } from "./command";
import type { ClercFlagsDefinition } from "./flag";
import type { InferParameters } from "./parameters";

export interface BaseContext<
	C extends Command = Command,
	GF extends ClercFlagsDefinition = {},
> {
	resolved: boolean;
	command?: C;
	calledAs?: string;
	parameters: InferParameters<NonNullable<C["parameters"]>>;
	flags: InferFlags<
		NonNullable<C["flags"]> & Omit<GF, keyof NonNullable<C["flags"]>>
	>;
	ignored: string[];
	rawParsed: ParsedResult<
		InferFlags<
			NonNullable<C["flags"]> & Omit<GF, keyof NonNullable<C["flags"]>>
		>
	>;
}
