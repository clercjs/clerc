import type { Clerc, RootType } from "./cli";
import type {
	Command,
	CommandOptions,
	CommandWithHandler,
	Handler,
	HandlerContext,
	HandlerInCommand,
	Interceptor,
	Plugin,
} from "./types";

export const definePlugin = <T extends Clerc, U extends Clerc>(
	p: Plugin<T, U>,
) => p;

export const defineHandler = <C extends Clerc, K extends keyof C["_commands"]>(
	_cli: C,
	_key: K,
	handler: Handler<C["_commands"], K>,
) => handler;

export const defineInterceptor = <C extends Clerc>(
	_cli: C,
	interceptor: Interceptor<C["_commands"]>,
) => interceptor;

/**
 * @deprecated This is a typo. Use `defineInterceptor` instead.
 */
export const defineInspector = defineInterceptor;

export const defineCommand = <
	N extends string | RootType,
	O extends CommandOptions<[...P]>,
	P extends string[],
>(
	command: Command<N, O & CommandOptions<[...P]>>,
	handler?: HandlerInCommand<
		HandlerContext<Record<N, Command<N, O>> & Record<never, never>, N>
	>,
): CommandWithHandler<N, O & CommandOptions<[...P]>> => ({
	...command,
	handler,
});
