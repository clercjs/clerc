import type { ContextualFlags, FlagsDefinition, OverrideFlags } from "./flags";
import type { AnyMiddlewareFn, ScopeState } from "./scope";
import { Scope, getScopeState } from "./scope";
import type {
  ExtractMiddlewareState,
  GroupDefinition,
  GroupsInput,
  MiddlewareNext,
  MiddlewareOptions,
  RunContext,
} from "./types";

type GroupScope = keyof GroupsInput;
type GroupBuckets = Record<GroupScope, GroupDefinition[]>;

export interface PluginState {
  readonly scope: ScopeState;
  readonly groups: GroupBuckets;
  readonly plugins: Map<string, Plugin<any, any>>;
}

export const GROUP_SCOPES: readonly GroupScope[] = [
  "commands",
  "flags",
  "globalFlags",
];

export const createGroupBuckets = (): GroupBuckets => ({
  commands: [],
  flags: [],
  globalFlags: [],
});

let readPluginExtra: (target: Plugin<any, any>) => {
  readonly groups: GroupBuckets;
  readonly plugins: Map<string, Plugin<any, any>>;
};

export function collectPluginStates(
  root: Plugin<any, any>,
): readonly PluginState[] {
  const winners = new Map<string, Plugin<any, any>>();
  const seen = new Set<Plugin<any, any>>();
  function scan(target: Plugin<any, any>): void {
    if (seen.has(target)) {
      return;
    }
    seen.add(target);
    for (const child of readPluginExtra(target).plugins.values()) {
      scan(child);
    }
    winners.set(target.pluginName, target);
  }
  scan(root);

  const states: PluginState[] = [];
  const visited = new Set<string>();
  function visit(target: Plugin<any, any>): void {
    if (visited.has(target.pluginName)) {
      return;
    }
    visited.add(target.pluginName);
    const winner = winners.get(target.pluginName)!;
    const extra = readPluginExtra(winner);
    for (const child of extra.plugins.values()) {
      visit(child);
    }
    states.push({
      scope: getScopeState(winner),
      ...extra,
    });
  }
  visit(root);

  return states;
}

export class Plugin<
  TGlobalFlags extends Record<string, any> = {},
  TState extends Record<string, any> = {},
> extends Scope<TGlobalFlags, TState> {
  public readonly pluginName: string;
  readonly #extra = {
    groups: createGroupBuckets(),
    plugins: new Map<string, Plugin<any, any>>(),
  };

  static {
    readPluginExtra = (target) => target.#extra;
  }

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

  public groups(definitions: GroupsInput): this {
    for (const scope of GROUP_SCOPES) {
      const entries = definitions[scope];
      if (!entries) {
        continue;
      }
      for (const [key, title] of Object.entries(entries)) {
        this.#extra.groups[scope].push({ key, title });
      }
    }
    this.invalidate();

    return this;
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

  public use<
    PFlags extends Record<string, any> = {},
    PState extends Record<string, any> = {},
  >(
    other: Plugin<PFlags, PState>,
  ): Plugin<OverrideFlags<TGlobalFlags, PFlags>, TState & PState> {
    this.#extra.plugins.set(other.pluginName, other);
    this.invalidate();

    return this as any;
  }
}

export const plugin = (name: string): Plugin => new Plugin(name);
