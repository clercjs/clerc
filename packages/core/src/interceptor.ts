import type { PartialRequired } from "@clerc/utils";

import type {
  ClercFlagsDefinition,
  Command,
  Interceptor,
  InterceptorContext,
  InterceptorObject,
} from "./types";

function normalizeInspector<C extends Command, GF extends ClercFlagsDefinition>(
  inspector: Interceptor<C, GF>,
): PartialRequired<InterceptorObject<C, GF>, "enforce"> {
  if (typeof inspector === "function") {
    return { enforce: "normal", handler: inspector };
  }

  return {
    enforce: inspector.enforce ?? "normal",
    handler: inspector.handler,
  };
}

export function compose<C extends Command, GF extends ClercFlagsDefinition>(
  inspectors: Interceptor<C, GF>[],
): (context: InterceptorContext<C, GF>) => Promise<void> {
  const normalized = inspectors.map(normalizeInspector);
  const pre = normalized.filter((i) => i.enforce === "pre");
  const normal = normalized.filter((i) => i.enforce === "normal");
  const post = normalized.filter((i) => i.enforce === "post");

  const orderedInspectors = [...pre, ...normal, ...post];

  return async (context: InterceptorContext<C, GF>) => {
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
