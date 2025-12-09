import type { InferFlags, ParsedResult } from "@clerc/parser";

import type { Command } from "./command";
import type { InferParameters } from "./parameters";

export interface BaseContext<C extends Command = Command> {
	resolved: boolean;
	command?: C;
	calledAs?: string;
	parameters: InferParameters<NonNullable<C["parameters"]>>;
	flags: InferFlags<NonNullable<C["flags"]>>;
	ignored: string[];
	rawParsed: ParsedResult<InferFlags<NonNullable<C["flags"]>>>;
}
