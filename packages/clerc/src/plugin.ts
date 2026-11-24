import type { ArgDefinitionValue, ExtractArgNames, NonEmptySpec } from "./args";
import { parseCommandSpec } from "./args";
import type { ContextualFlags, FlagsDefinition, InferFlags } from "./flags";
import type { RulesFactory } from "./rules";
import type {
  AnyCommandDefinition,
  CommandOptions,
  ErrorHandler,
  ExtractMiddlewareState,
  GroupDefinition,
  GroupsInput,
  MiddlewareNext,
  MiddlewareOptions,
  RootCommandOptions,
  RunContext,
} from "./types";

export type GroupScope = keyof GroupsInput;
export type GroupBuckets = Record<GroupScope, GroupDefinition[]>;

export type AnyMiddlewareFn = (
  ctx: RunContext<any, any>,
  next: MiddlewareNext,
) => unknown;

export interface RegisteredMiddleware {
  readonly fn: AnyMiddlewareFn;
  readonly enforce?: "pre" | "post";
}

export interface PluginState {
  readonly flags: FlagsDefinition;
  readonly rules: RulesFactory<any, any, any, any>[];
  readonly commands: AnyCommandDefinition[];
  readonly groups: GroupBuckets;
  readonly middlewares: RegisteredMiddleware[];
  readonly errorHandlers: ErrorHandler<any, any>[];
  readonly plugins: Map<string, Plugin<any, any>>;
  onInvalidate?: () => void;
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

let readPluginState: (target: Plugin<any, any>) => PluginState;

export const getPluginState = (target: Plugin<any, any>): PluginState =>
  readPluginState(target);

export function collectPluginStates(
  root: Plugin<any, any>,
): readonly PluginState[] {
  const winners = new Map<string, Plugin<any, any>>();
  const seen = new Set<Plugin<any, any>>();
  function scan(scope: Plugin<any, any>): void {
    if (seen.has(scope)) {
      return;
    }
    seen.add(scope);
    for (const child of readPluginState(scope).plugins.values()) {
      scan(child);
    }
    winners.set(scope.pluginName, scope);
  }
  scan(root);

  const states: PluginState[] = [];
  const visited = new Set<string>();
  function visit(scope: Plugin<any, any>): void {
    if (visited.has(scope.pluginName)) {
      return;
    }
    visited.add(scope.pluginName);
    const state = readPluginState(winners.get(scope.pluginName)!);
    for (const child of state.plugins.values()) {
      visit(child);
    }
    states.push(state);
  }
  visit(root);

  return states;
}

export class Plugin<
  TGlobalFlags extends Record<string, any> = {},
  TState extends Record<string, any> = {},
> {
  public readonly pluginName: string;
  readonly #state: PluginState = {
    flags: {},
    rules: [],
    commands: [],
    groups: createGroupBuckets(),
    middlewares: [],
    errorHandlers: [],
    plugins: new Map(),
  };

  static {
    readPluginState = (target) => target.#state;
  }

  constructor(name: string) {
    this.pluginName = name;
  }

  public flags<const Flags extends FlagsDefinition>(
    definitions: ContextualFlags<Flags>,
  ): Plugin<TGlobalFlags & Flags, TState> {
    Object.assign(this.#state.flags, definitions);
    this.#state.onInvalidate?.();

    return this as any;
  }

  public rules(
    factory: RulesFactory<
      keyof InferFlags<TGlobalFlags> & string,
      never,
      Record<string, any>,
      InferFlags<TGlobalFlags>
    >,
  ): this {
    this.#state.rules.push(factory);
    this.#state.onInvalidate?.();

    return this;
  }

  public groups(definitions: GroupsInput): this {
    for (const scope of GROUP_SCOPES) {
      const entries = definitions[scope];
      if (!entries) {
        continue;
      }
      for (const [key, title] of Object.entries(entries)) {
        this.#state.groups[scope].push({ key, title });
      }
    }
    this.#state.onInvalidate?.();

    return this;
  }

  public command<const Flags extends FlagsDefinition = {}>(
    options: RootCommandOptions<Flags, TGlobalFlags, TState>,
  ): this;
  public command<
    const Spec extends string,
    const Args extends Partial<
      Record<ExtractArgNames<Spec>, ArgDefinitionValue>
    > = {},
    const Flags extends FlagsDefinition = {},
  >(
    spec: NonEmptySpec<Spec>,
    options?: CommandOptions<Spec, Args, Flags, TGlobalFlags, TState>,
  ): this;
  public command(
    specOrOptions: string | RootCommandOptions<any, any, any>,
    maybeOptions?: CommandOptions<any, any, any, any, any>,
  ): this {
    if (typeof specOrOptions === "string") {
      const trimmedSpec = specOrOptions.trim();
      const { name, argTokens } = parseCommandSpec(trimmedSpec);
      this.#state.commands.push({
        ...maybeOptions,
        spec: trimmedSpec,
        name,
        argTokens,
      });
    } else {
      this.#state.commands.push({
        ...specOrOptions,
        spec: "",
        name: "",
        argTokens: [],
      });
    }
    this.#state.onInvalidate?.();

    return this;
  }

  public middleware<R = void>(
    fn: (ctx: RunContext<TGlobalFlags>, next: MiddlewareNext) => R,
    options: { readonly enforce: "pre" },
  ): Plugin<TGlobalFlags, TState & ExtractMiddlewareState<R>>;
  public middleware<R = void>(
    fn: (ctx: RunContext<TGlobalFlags, TState>, next: MiddlewareNext) => R,
    options?: MiddlewareOptions,
  ): Plugin<TGlobalFlags, TState & ExtractMiddlewareState<R>>;
  public middleware(fn: AnyMiddlewareFn, options?: MiddlewareOptions): this {
    this.#state.middlewares.push({ fn, enforce: options?.enforce });
    this.#state.onInvalidate?.();

    return this;
  }

  public onError(fn: ErrorHandler<TGlobalFlags, TState>): this {
    this.#state.errorHandlers.push(fn as ErrorHandler<any, any>);
    this.#state.onInvalidate?.();

    return this;
  }

  public use<
    PFlags extends Record<string, any> = {},
    PState extends Record<string, any> = {},
  >(
    other: Plugin<PFlags, PState>,
  ): Plugin<TGlobalFlags & PFlags, TState & PState> {
    this.#state.plugins.set(other.pluginName, other);
    this.#state.onInvalidate?.();

    return this as any;
  }
}

export const plugin = (name: string): Plugin => new Plugin(name);
