import type { ArgDefinitionValue, ExtractArgNames, NonEmptySpec } from "./args";
import { parseCommandSpec } from "./args";
import { InvalidSchemaError } from "./errors";
import type {
  ContextualFlags,
  FlagsDefinition,
  InferFlags,
  OverrideFlags,
} from "./flags";
import type { RulesEntry, RulesInput } from "./rules";
import { normalizeRulesInput } from "./rules";
import type {
  AnyCommandDefinition,
  CommandOptions,
  ErrorHandler,
  ExtractMiddlewareState,
  MiddlewareNext,
  MiddlewareOptions,
  RootCommandOptions,
  RunContext,
  ScopeOptions,
  SubcommandOptions,
} from "./types";

export type AnyMiddlewareFn = (
  ctx: RunContext<any, any>,
  next: MiddlewareNext,
) => unknown;

export interface RegisteredMiddleware {
  readonly fn: AnyMiddlewareFn;
  readonly enforce?: "pre" | "post";
}

export interface ScopeState {
  readonly prefix: readonly string[];
  readonly namespaceMeta?: SubcommandOptions;
  readonly defaultGroup?: string;
  readonly flags: FlagsDefinition;
  readonly rules: RulesEntry<any, any, any, any>[];
  readonly commands: AnyCommandDefinition[];
  readonly middlewares: RegisteredMiddleware[];
  readonly errorHandlers: ErrorHandler<any, any>[];
  readonly children: Scope<any, any>[];
  onInvalidate?: () => void;
}

let readScopeState: (target: Scope<any, any>) => ScopeState;

export const getScopeState = (target: Scope<any, any>): ScopeState =>
  readScopeState(target);

export class Scope<
  TFlags extends Record<string, any> = {},
  TState extends Record<string, any> = {},
> {
  readonly #state: ScopeState;

  static {
    readScopeState = (target) => target.#state;
  }

  constructor(
    prefix: readonly string[] = [],
    namespaceMeta?: SubcommandOptions,
    defaultGroup?: string,
  ) {
    this.#state = {
      prefix,
      namespaceMeta,
      defaultGroup,
      flags: {},
      rules: [],
      commands: [],
      middlewares: [],
      errorHandlers: [],
      children: [],
    };
  }

  protected invalidate(): void {
    this.#state.onInvalidate?.();
  }

  public flags<const Flags extends FlagsDefinition>(
    definitions: ContextualFlags<Flags>,
  ): Scope<OverrideFlags<TFlags, Flags>, TState> {
    Object.assign(this.#state.flags, definitions);
    this.invalidate();

    return this as any;
  }

  public rules(
    input: RulesInput<
      keyof InferFlags<TFlags> & string,
      never,
      Record<string, any>,
      InferFlags<TFlags>
    >,
  ): this {
    this.#state.rules.push(...normalizeRulesInput(input));
    this.invalidate();

    return this;
  }

  public command<const Flags extends FlagsDefinition = {}>(
    options: RootCommandOptions<Flags, TFlags, TState>,
  ): this;
  public command<
    const Spec extends string,
    const Args extends Partial<
      Record<ExtractArgNames<Spec>, ArgDefinitionValue>
    > = {},
    const Flags extends FlagsDefinition = {},
  >(
    spec: NonEmptySpec<Spec>,
    options?: CommandOptions<Spec, Args, Flags, TFlags, TState>,
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
    this.invalidate();

    return this;
  }

  public middleware<R = void>(
    fn: (ctx: RunContext<TFlags>, next: MiddlewareNext) => R,
    options: { readonly enforce: "pre" },
  ): Scope<TFlags, TState & ExtractMiddlewareState<R>>;
  public middleware<R = void>(
    fn: (ctx: RunContext<TFlags, TState>, next: MiddlewareNext) => R,
    options?: MiddlewareOptions,
  ): Scope<TFlags, TState & ExtractMiddlewareState<R>>;
  public middleware(fn: AnyMiddlewareFn, options?: MiddlewareOptions): this {
    this.#state.middlewares.push({ fn, enforce: options?.enforce });
    this.invalidate();

    return this;
  }

  public onError(fn: ErrorHandler<TFlags, TState>): this {
    this.#state.errorHandlers.push(fn as ErrorHandler<any, any>);
    this.invalidate();

    return this;
  }

  public scope(options?: ScopeOptions): Scope<TFlags, TState> {
    const child = new Scope<TFlags, TState>([], undefined, options?.group);
    child.#state.onInvalidate = () => this.invalidate();
    this.#state.children.push(child);
    this.invalidate();

    return child;
  }

  public subcommand(
    name: string,
    options: SubcommandOptions = {},
  ): Scope<TFlags, TState> {
    const trimmed = name.trim();
    if (trimmed === "") {
      throw new InvalidSchemaError("Subcommand name cannot be empty.");
    }
    const parsed = parseCommandSpec(trimmed);
    if (parsed.argTokens.length > 0 || parsed.name === "") {
      throw new InvalidSchemaError(
        `Subcommand "${trimmed}" cannot contain positional arguments; define arguments on .command() instead.`,
      );
    }
    const prefix = parsed.name.split(/\s+/);
    const child = new Scope<TFlags, TState>(prefix, options);
    child.#state.onInvalidate = () => this.invalidate();
    this.#state.children.push(child);
    this.invalidate();

    return child;
  }
}
