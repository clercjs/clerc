import type { PartialRequired } from "@clerc/utils";

import type {
	Command,
	Interceptor,
	InterceptorContext,
	InterceptorObject,
} from "./types";

function normalizeInspector<C extends Command>(
	inspector: Interceptor<C>,
): PartialRequired<InterceptorObject<C>, "enforce"> {
	if (typeof inspector === "function") {
		return { enforce: "normal", handler: inspector };
	}

	return {
		enforce: inspector.enforce ?? "normal",
		handler: inspector.handler,
	};
}

export function compose<C extends Command>(
	inspectors: Interceptor<C>[],
): (context: InterceptorContext<C>) => Promise<void> {
	const normalized = inspectors.map(normalizeInspector);
	const pre = normalized.filter((i) => i.enforce === "pre");
	const normal = normalized.filter((i) => i.enforce === "normal");
	const post = normalized.filter((i) => i.enforce === "post");

	const orderedInspectors = [...pre, ...normal, ...post];

	return async (context: InterceptorContext<C>) => {
		let index = 0;

		async function dispatch(): Promise<void> {
			if (index >= orderedInspectors.length) {
				return;
			}

			const inspector = orderedInspectors[index++];
			await inspector.handler(context, dispatch);
		}

		await dispatch();
	};
}
