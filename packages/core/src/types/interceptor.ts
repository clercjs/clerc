import type { DeepPrettify } from "@clerc/utils";

import type { Command } from "./command";
import type { BaseContext } from "./context";

export type InterceptorContext<C extends Command = Command> = DeepPrettify<
	BaseContext<C>
>;

export type InterceptorNext = () => void | Promise<void>;

export type InterceptorHandler<C extends Command = Command> = (
	context: InterceptorContext<C>,
	next: InterceptorNext,
) => void | Promise<void>;

export interface InterceptorObject<C extends Command = Command> {
	enforce?: "pre" | "normal" | "post";
	handler: InterceptorHandler<C>;
}

export type Interceptor<C extends Command = Command> =
	| InterceptorHandler<C>
	| InterceptorObject<C>;
