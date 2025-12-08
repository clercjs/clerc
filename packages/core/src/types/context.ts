import type { InferFlags, ParsedResult } from "@clerc/parser";
import type { DeepPrettify, PartialRequired } from "@clerc/utils";

import type { Command } from "./command";
import type { InferParameters } from "./parameters";

export interface BaseContext<C extends Command = Command> {
	resolved: boolean;
	command?: C;
	calledAs?: string;
	parameters: InferParameters<NonNullable<C["parameters"]>>;
	flags: InferFlags<NonNullable<C["flags"]>>;
	rawParsed: ParsedResult<InferFlags<NonNullable<C["flags"]>>>;
}

export type HandlerContext<C extends Command> = DeepPrettify<
	PartialRequired<BaseContext<C>, "command" | "calledAs"> & {
		resolved: true;
	}
>;
