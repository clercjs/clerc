import type { ContextualFlags, FlagsDefinition, OverrideFlags } from "./flags";
import type { AnyMiddlewareFn, ScopeState } from "./scope";
import { Scope, getScopeState } from "./scope";
import type {
  ExtractMiddlewareState,
  MiddlewareNext,
  MiddlewareOptions,
  RunContext,
} from "./types";

export function collectPluginStates(
  roots: Plugin<any, any> | Iterable<Plugin<any, any>>,
): readonly ScopeState[] {
  const rootList = roots instanceof Plugin ? [roots] : [...roots];
  const winners = new Map<string, Plugin<any, any>>();
  const seen = new Set<Plugin<any, any>>();
  function scan(target: Plugin<any, any>): void {
    if (seen.has(target)) {
      return;
    }
    seen.add(target);
    for (const child of getScopeState(target).plugins.values()) {
      scan(child);
    }
    winners.set(target.pluginName, target);
  }
  for (const root of rootList) {
    scan(root);
  }

  const states: ScopeState[] = [];
  const visited = new Set<string>();
  function visit(target: Plugin<any, any>): void {
    if (visited.has(target.pluginName)) {
      return;
    }
    visited.add(target.pluginName);
    const winner = winners.get(target.pluginName)!;
    const state = getScopeState(winner);
    for (const child of state.plugins.values()) {
      visit(child);
    }
    states.push(state);
  }
  for (const root of rootList) {
    visit(root);
  }

  return states;
}

export class Plugin<
  TGlobalFlags extends Record<string, any> = {},
  TState extends Record<string, any> = {},
> extends Scope<TGlobalFlags, TState> {
  public readonly pluginName: string;

  constructor(name: string) {
    super();
    this.pluginName = name;
  }

  public override flags<const Flags extends FlagsDefinition>(
    definitions: ContextualFlags<Flags>,
  ): Plugin<OverrideFlags<TGlobalFlags, Flags>, TState> {
    super.flags(definitions);

    return this as any;
  }

  public override middleware<R = void>(
    fn: (ctx: RunContext<TGlobalFlags>, next: MiddlewareNext) => R,
    options: { readonly enforce: "pre" },
  ): Plugin<TGlobalFlags, TState & ExtractMiddlewareState<R>>;
  public override middleware<R = void>(
    fn: (ctx: RunContext<TGlobalFlags, TState>, next: MiddlewareNext) => R,
    options?: MiddlewareOptions,
  ): Plugin<TGlobalFlags, TState & ExtractMiddlewareState<R>>;
  public override middleware(
    fn: AnyMiddlewareFn,
    options?: MiddlewareOptions,
  ): this {
    super.middleware(fn as any, options);

    return this;
  }

  public override use<
    PFlags extends Record<string, any> = {},
    PState extends Record<string, any> = {},
  >(
    other: Plugin<PFlags, PState>,
  ): Plugin<OverrideFlags<TGlobalFlags, PFlags>, TState & PState> {
    super.use(other);

    return this as any;
  }
}

export const plugin = (name: string): Plugin => new Plugin(name);
