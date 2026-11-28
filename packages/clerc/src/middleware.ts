import type { CheckInput } from "./check";
import type {
  FlagsInput,
  InferFlagsInput,
  MergeFlagsTypes,
  ValidateFlagsInput,
} from "./flags";
import type { ErrorHandler, MiddlewareContext } from "./types";
import type { Prettify } from "./utils";

export const MIDDLEWARE_NODE: unique symbol = Symbol.for("clerc.middleware");

export type MiddlewareNext = () => Promise<void>;

export type MiddlewareFn<
  TFlags = {},
  TState extends Record<string, any> = {},
> = (
  ctx: MiddlewareContext<TFlags, TState>,
  next: MiddlewareNext,
) => void | Promise<void>;

export interface Middleware<
  TFlags = {},
  TState extends Record<string, any> = {},
> {
  readonly [MIDDLEWARE_NODE]: true;
  readonly "use"?: readonly Middleware<any, any>[];
  readonly "flags"?: FlagsInput;
  readonly "check"?: CheckInput<any, any>;
  readonly "onError"?: ErrorHandler<any, any>;
  readonly "setup"?: (ctx: MiddlewareContext<any, any>) => unknown;
  readonly "run"?: MiddlewareFn<any, any>;
  readonly "~flags"?: TFlags;
  readonly "~state"?: TState;
}

export type InferMiddlewareFlags<M> =
  M extends Middleware<infer F, any> ? F : {};

export type InferMiddlewareState<M> =
  M extends Middleware<any, infer S> ? S : {};

export type InferMiddlewaresFlags<
  List extends readonly Middleware<any, any>[],
  Acc = {},
> = List extends readonly [
  infer Head,
  ...infer Tail extends readonly Middleware<any, any>[],
]
  ? InferMiddlewaresFlags<
      Tail,
      MergeFlagsTypes<Acc, InferMiddlewareFlags<Head>>
    >
  : Acc;

export type InferMiddlewaresState<
  List extends readonly Middleware<any, any>[],
  Acc extends Record<string, any> = {},
> = List extends readonly [
  infer Head,
  ...infer Tail extends readonly Middleware<any, any>[],
]
  ? InferMiddlewaresState<Tail, Acc & InferMiddlewareState<Head>>
  : Prettify<Acc>;

type NormalizeSetupState<R> =
  Awaited<R> extends Record<string, any> ? Awaited<R> : {};

export interface MiddlewareOptions<
  Use extends readonly Middleware<any, any>[] = readonly [],
  F extends FlagsInput = {},
  SetupReturn = void,
> {
  readonly use?: Use;
  readonly flags?: ValidateFlagsInput<F>;
  readonly check?: CheckInput<
    Record<string, any>,
    MergeFlagsTypes<InferMiddlewaresFlags<Use>, InferFlagsInput<NoInfer<F>>>
  >;
  readonly onError?: ErrorHandler<
    MergeFlagsTypes<InferMiddlewaresFlags<Use>, InferFlagsInput<NoInfer<F>>>,
    InferMiddlewaresState<Use> & NormalizeSetupState<NoInfer<SetupReturn>>
  >;
  readonly setup?: (
    ctx: MiddlewareContext<
      MergeFlagsTypes<InferMiddlewaresFlags<Use>, InferFlagsInput<NoInfer<F>>>,
      InferMiddlewaresState<Use>
    >,
  ) => SetupReturn;
  readonly run?: MiddlewareFn<
    MergeFlagsTypes<InferMiddlewaresFlags<Use>, InferFlagsInput<NoInfer<F>>>,
    InferMiddlewaresState<Use> & NormalizeSetupState<NoInfer<SetupReturn>>
  >;
}

export function middleware(fn: MiddlewareFn): Middleware;
export function middleware<
  const Use extends readonly Middleware<any, any>[] = readonly [],
  const F extends FlagsInput = {},
  SetupReturn = void,
>(
  options: MiddlewareOptions<Use, F, SetupReturn>,
): Middleware<
  MergeFlagsTypes<InferMiddlewaresFlags<Use>, InferFlagsInput<F>>,
  Prettify<InferMiddlewaresState<Use> & NormalizeSetupState<SetupReturn>>
>;
export function middleware(
  input: MiddlewareFn<any, any> | MiddlewareOptions<any, any, any>,
): Middleware<any, any> {
  if (typeof input === "function") {
    return {
      [MIDDLEWARE_NODE]: true,
      run: input,
    };
  }

  return {
    [MIDDLEWARE_NODE]: true,
    use: input.use,
    flags: input.flags as FlagsInput | undefined,
    check: input.check,
    onError: input.onError,
    setup: input.setup,
    run: input.run,
  };
}

export function expandMiddlewares(
  list: readonly Middleware<any, any>[],
  seen = new Set<Middleware<any, any>>(),
  out: Middleware<any, any>[] = [],
): Middleware<any, any>[] {
  for (const mw of list) {
    if (seen.has(mw)) {
      continue;
    }
    if (mw.use && mw.use.length > 0) {
      expandMiddlewares(mw.use, seen, out);
    }
    if (!seen.has(mw)) {
      seen.add(mw);
      out.push(mw);
    }
  }

  return out;
}
