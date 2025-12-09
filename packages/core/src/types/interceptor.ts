import type { DeepPrettify } from "@clerc/utils";

import type { Command } from "./command";
import type { BaseContext } from "./context";

export type InterceptorContext<C extends Command = Command> = DeepPrettify<
	BaseContext<C>
>;

/**
 * Function to call the next interceptor in the chain.
 * **MUST** be awaited.
 */
export type InterceptorNext = () => void | Promise<void>;

export type InterceptorHandler<C extends Command = Command> = (
	context: InterceptorContext<C>,
	/**
	 * Function to call the next interceptor in the chain.
	 * **MUST** be awaited.
	 */
	next: InterceptorNext,
) => void | Promise<void>;

export interface InterceptorObject<C extends Command = Command> {
	enforce?: "pre" | "normal" | "post";
	handler: InterceptorHandler<C>;
}

export type Interceptor<C extends Command = Command> =
	| InterceptorHandler<C>
	| InterceptorObject<C>;
