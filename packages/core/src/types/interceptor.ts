import type { DeepPrettify } from "@clerc/utils";

import type { Command } from "./command";
import type { BaseContext } from "./context";
import type { ClercFlagsDefinition } from "./flag";

export type InterceptorContext<
	C extends Command = Command,
	GF extends ClercFlagsDefinition = {},
> = DeepPrettify<BaseContext<C, GF>>;

/**
 * Function to call the next interceptor in the chain.
 * **MUST** be awaited.
 */
export type InterceptorNext = () => void | Promise<void>;

export type InterceptorHandler<
	C extends Command = Command,
	GF extends ClercFlagsDefinition = {},
> = (
	context: InterceptorContext<C, GF>,
	/**
	 * Function to call the next interceptor in the chain.
	 * **MUST** be awaited.
	 */
	next: InterceptorNext,
) => void | Promise<void>;

export interface InterceptorObject<
	C extends Command = Command,
	GF extends ClercFlagsDefinition = {},
> {
	enforce?: "pre" | "normal" | "post";
	handler: InterceptorHandler<C, GF>;
}

export type Interceptor<
	C extends Command = Command,
	GF extends ClercFlagsDefinition = {},
> = InterceptorHandler<C, GF> | InterceptorObject<C, GF>;
