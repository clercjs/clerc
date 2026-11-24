import type { LoggerOptions } from "@clerc/logger";
import { createLogger } from "@clerc/logger";
import type { ThemeStyleMap } from "@clerc/theme";
import { createTheme } from "@clerc/theme";

import type { CompiledArgs } from "./args";
import { compileArgs, executeCompiledArgs, parseCommandSpec } from "./args";
import { CommandTreeBuilder } from "./command-tree";
import {
  ClercError,
  InvalidCommandError,
  MissingRequiredMetadataError,
  NoCommandError,
  UnknownCommandError,
  enrichCommandError,
  formatDiagnostic,
  formatJsonError,
} from "./errors";
import type { CompiledFlags } from "./flags";
import {
  buildCompiledFlags,
  compileFlagEntries,
  createBuiltinFlagDescriptor,
  resolveCompiledFlags,
  validateParsedFlags,
  validateResolvedFlags,
  warnFlagDeprecations,
} from "./flags";
import { renderHelp } from "./help/renderer";
import type { ArgvFlagSpec, ArgvParseResult, ArgvParser } from "./parser";
import { DOUBLE_DASH, createArgvParser } from "./parser";
import { createTerminal } from "./terminal";
import type {
  AnyCommandDefinition,
  ArgDefinitionValue,
  ClercOptions,
  CliMeta,
  CliModel,
  CommandNode,
  CommandOptions,
  CompletionContext,
  ContextualFlags,
  ErrorContext,
  ErrorHandler,
  ExtractArgNames,
  ExtractMiddlewareState,
  FlagDescriptor,
  FlagsDefinition,
  GroupDefinition,
  GroupsInput,
  HelpOptions,
  MiddlewareNext,
  MiddlewareOptions,
  NonEmptySpec,
  RawParseContext,
  RootCommandOptions,
  RunContext,
  RunOptions,
  RunResult,
} from "./types";
import { formatVersion } from "./utils";

type GroupScope = keyof GroupsInput;
type GroupBuckets = Record<GroupScope, GroupDefinition[]>;
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type InternalContext<
  TGlobalFlags extends Record<string, any>,
  TState extends Record<string, any>,
> = Mutable<Omit<ErrorContext<TGlobalFlags, TState>, "state" | "raw">> & {
  state: Record<string, any>;
  raw: Mutable<RawParseContext>;
};
type AnyMiddlewareFn = (
  ctx: RunContext<any, any>,
  next: MiddlewareNext,
) => unknown;

interface RegisteredMiddleware {
  readonly fn: AnyMiddlewareFn;
  readonly enforce?: "pre" | "post";
}

interface PluginState {
  readonly flags: FlagsDefinition;
  readonly commands: AnyCommandDefinition[];
  readonly groups: GroupBuckets;
  readonly middlewares: RegisteredMiddleware[];
  readonly errorHandlers: ErrorHandler<any, any>[];
  readonly plugins: Map<string, Plugin<any, any>>;
  onInvalidate?: () => void;
}

interface CompiledNodeRuntime {
  readonly userFlags: CompiledFlags;
  readonly knownFlagNames: readonly string[];
  readonly parser: ArgvParser;
  readonly args?: CompiledArgs;
  readonly hasBuiltinHelp: boolean;
  readonly hasBuiltinVersion: boolean;
  readonly hasBuiltinQuiet: boolean;
  readonly hasBuiltinVerbose: boolean;
}

interface CompiledCli {
  readonly model: CliModel;
  readonly tree: CommandTreeBuilder;
  readonly defaultNode?: CommandNode;
  readonly defaultAcceptsArgs: boolean;
  readonly middlewares: readonly AnyMiddlewareFn[];
  readonly errorHandlers: readonly ErrorHandler<any, any>[];
  readonly rootRuntime: CompiledNodeRuntime;
  readonly runtimes: ReadonlyMap<CommandNode, CompiledNodeRuntime>;
}

const GROUP_SCOPES: readonly GroupScope[] = [
  "commands",
  "flags",
  "globalFlags",
];

const EMPTY_DESCRIPTORS: readonly never[] = Object.freeze([]);
const ENFORCE_RANK = { pre: 0, normal: 1, post: 2 } as const;

const createGroupBuckets = (): GroupBuckets => ({
  commands: [],
  flags: [],
  globalFlags: [],
});

const formatCliVersion = (meta: CliMeta): string =>
  `${meta.name} ${formatVersion(meta.version)}`.trim();

function resolveNodeBuiltins(options: {
  readonly isRoot: boolean;
  readonly isStandalone: boolean;
  readonly enableVerbosity: boolean;
  readonly enableVersion: boolean;
  readonly enableHelp: boolean;
  readonly userFlags: CompiledFlags;
}): {
  readonly descriptors: readonly FlagDescriptor[];
  readonly specs: readonly ArgvFlagSpec[];
  readonly names: readonly string[];
  readonly hasQuiet: boolean;
  readonly hasVerbose: boolean;
  readonly hasHelp: boolean;
  readonly hasVersion: boolean;
} {
  const {
    isRoot,
    isStandalone,
    enableVerbosity,
    enableVersion,
    enableHelp,
    userFlags,
  } = options;
  const usedNames = new Set(userFlags.knownNames);
  const usedShorts = new Set<string>();
  for (const spec of userFlags.specs) {
    if (spec.short) {
      usedShorts.add(spec.short);
    }
  }

  const descriptors: FlagDescriptor[] = [];
  const specs: ArgvFlagSpec[] = [];
  const names: string[] = [];

  function tryAdd(
    key: string,
    shortChar: string,
    desc: string,
    kind: "boolean" | "counter" = "boolean",
  ): boolean {
    if (usedNames.has(key)) {
      return false;
    }
    const short = usedShorts.has(shortChar) ? undefined : shortChar;
    if (short) {
      usedShorts.add(short);
    }
    descriptors.push(createBuiltinFlagDescriptor(key, short, desc, kind));
    specs.push({ key, kind, short, negatable: false });
    names.push(key);

    return true;
  }

  return {
    descriptors,
    specs,
    names,
    hasQuiet:
      !isStandalone &&
      enableVerbosity &&
      tryAdd("quiet", "q", "Suppress non-error output"),
    hasVerbose:
      !isStandalone &&
      enableVerbosity &&
      tryAdd("verbose", "v", "Enable verbose debug logging", "counter"),
    hasVersion:
      isRoot && enableVersion && tryAdd("version", "V", "Show version"),
    hasHelp: enableHelp && tryAdd("help", "h", "Show help"),
  };
}

let getPluginState: (plugin: Plugin<any, any>) => PluginState;

function collectStates(root: Plugin<any, any>): readonly PluginState[] {
  const winners = new Map<string, Plugin<any, any>>();
  const seen = new Set<Plugin<any, any>>();
  function scan(scope: Plugin<any, any>): void {
    if (seen.has(scope)) {
      return;
    }
    seen.add(scope);
    for (const child of getPluginState(scope).plugins.values()) {
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
    const state = getPluginState(winners.get(scope.pluginName)!);
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
    commands: [],
    groups: createGroupBuckets(),
    middlewares: [],
    errorHandlers: [],
    plugins: new Map(),
  };

  static {
    getPluginState = (plugin) => plugin.#state;
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
  public middleware(
    fn: AnyMiddlewareFn,
    options?: MiddlewareOptions,
  ): Plugin<any, any> {
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

export class Clerc<
  TGlobalFlags extends Record<string, any> = {},
  TState extends Record<string, any> = {},
> extends Plugin<TGlobalFlags, TState> {
  readonly #meta: CliMeta;
  readonly #defaultCommand?: string;
  readonly #helpOptions: false | HelpOptions;
  readonly #verbosity: boolean;
  readonly #strictFlags: boolean;
  readonly #themeOverrides?: Partial<ThemeStyleMap>;
  readonly #loggerOptions?: LoggerOptions;
  #compiled?: CompiledCli;

  constructor(options: ClercOptions) {
    super("clerc:root");
    const name = options.name.trim();
    if (!name) {
      throw new MissingRequiredMetadataError("name");
    }
    this.#meta = {
      name,
      description: options.description ?? "",
      version: options.version ?? "",
      examples: options.examples,
      notes: options.notes,
    };
    this.#defaultCommand = options.defaultCommand;
    this.#helpOptions =
      options.help === false
        ? false
        : typeof options.help === "object"
          ? options.help
          : {};
    this.#verbosity = options.verbosity ?? true;
    this.#strictFlags = options.strictFlags ?? true;
    this.#themeOverrides = options.theme;
    this.#loggerOptions = options.logger;
    getPluginState(this).onInvalidate = () => {
      this.#compiled = undefined;
    };
  }

  public override flags<const Flags extends FlagsDefinition>(
    definitions: ContextualFlags<Flags>,
  ): Clerc<TGlobalFlags & Flags, TState> {
    super.flags(definitions);

    return this as any;
  }

  public override middleware<R = void>(
    fn: (ctx: RunContext<TGlobalFlags>, next: MiddlewareNext) => R,
    options: { readonly enforce: "pre" },
  ): Clerc<TGlobalFlags, TState & ExtractMiddlewareState<R>>;
  public override middleware<R = void>(
    fn: (ctx: RunContext<TGlobalFlags, TState>, next: MiddlewareNext) => R,
    options?: MiddlewareOptions,
  ): Clerc<TGlobalFlags, TState & ExtractMiddlewareState<R>>;
  public override middleware(
    fn: AnyMiddlewareFn,
    options?: MiddlewareOptions,
  ): Clerc<any, any> {
    super.middleware(fn as any, options);

    return this;
  }

  public override use<
    PFlags extends Record<string, any> = {},
    PState extends Record<string, any> = {},
  >(
    other: Plugin<PFlags, PState>,
  ): Clerc<TGlobalFlags & PFlags, TState & PState> {
    super.use(other);

    return this as any;
  }

  #ensureCompiled(): CompiledCli {
    if (this.#compiled) {
      return this.#compiled;
    }

    const states = collectStates(this);
    const globalFlagsInput: FlagsDefinition = {};
    const groups = createGroupBuckets();
    const registeredMiddlewares: RegisteredMiddleware[] = [];
    const errorHandlers: ErrorHandler<any, any>[] = [];
    const tree = new CommandTreeBuilder();

    for (const state of states) {
      Object.assign(globalFlagsInput, state.flags);
      registeredMiddlewares.push(...state.middlewares);
      errorHandlers.push(...state.errorHandlers);
      for (const scope of GROUP_SCOPES) {
        groups[scope].push(...state.groups[scope]);
      }
      for (const cmd of state.commands) {
        tree.register(cmd);
      }
    }

    if (this.#meta.version && !tree.findNode(["version"])) {
      tree.register({
        spec: "version",
        name: "version",
        argTokens: [],
        description: "Show version",
        builtin: true,
        standalone: true,
        run(ctx) {
          ctx.terminal.stdout(formatCliVersion(ctx.model.meta));
        },
      });
    }
    if (
      this.#helpOptions !== false &&
      this.#helpOptions.command !== false &&
      !tree.findNode(["help"])
    ) {
      const { name, argTokens } = parseCommandSpec("help [command...]");
      tree.register({
        spec: "help [command...]",
        name,
        argTokens,
        description: "Show help for a command",
        builtin: true,
        standalone: true,
        args: {
          command: {
            description: "Command to inspect",
            complete({ words, model }: CompletionContext) {
              const parent =
                words.length > 0 ? model.tree.findNode(words) : model.tree.root;
              if (!parent) {
                return [];
              }

              return model.tree
                .listVisibleChildren(parent)
                .filter((child) => child.command?.complete !== false)
                .map((child) => ({
                  value: child.name,
                  description: child.command?.description ?? "",
                }));
            },
          },
        },
        examples: (meta) => [
          [`$ ${meta.name} help`, "Show general help"],
          [`$ ${meta.name} help <command>`, "Show help for a command"],
        ],
        async run(ctx) {
          const path = ctx.args.command as string[];
          if (path.length > 0 && !ctx.model.tree.findNode(path)) {
            let parentPath: readonly string[] = [];
            for (let i = 1; i < path.length; i++) {
              const matched = ctx.model.tree.findNode(path.slice(0, i));
              if (!matched) {
                break;
              }
              parentPath = matched.fullPath;
            }

            throw new UnknownCommandError(path.join(" "), parentPath);
          }
          await ctx.help.print(path.length > 0 ? path : undefined);
        },
      });
    }

    const rawGlobalEntries = compileFlagEntries(globalFlagsInput);
    const globalFlags = buildCompiledFlags(rawGlobalEntries);
    const enableVersion = Boolean(this.#meta.version);
    const enableHelp = this.#helpOptions !== false;
    const enableVerbosity = this.#verbosity;
    const runtimes = new Map<CommandNode, CompiledNodeRuntime>();

    for (const node of tree.walkNodes()) {
      const isRoot = node.fullPath.length === 0;
      const cmd = node.command;
      const isNodeStandalone =
        Boolean(cmd?.standalone) || Boolean(cmd?.builtin);
      const localEntries = cmd?.flags
        ? compileFlagEntries(cmd.flags)
        : undefined;
      let userFlags = globalFlags;
      let localDescriptors: readonly FlagDescriptor[] = EMPTY_DESCRIPTORS;
      if (localEntries && localEntries.length > 0) {
        const localNames = new Set(localEntries.map((e) => e.name));
        userFlags = buildCompiledFlags([
          ...rawGlobalEntries.filter((e) => !localNames.has(e.name)),
          ...localEntries,
        ]);
        localDescriptors = localEntries.map((e) =>
          userFlags.byName.get(e.name)!,
        );
      }
      const builtins = resolveNodeBuiltins({
        isRoot,
        isStandalone: isNodeStandalone,
        enableVerbosity,
        enableVersion,
        enableHelp,
        userFlags,
      });

      const parser = createArgvParser([...userFlags.specs, ...builtins.specs], {
        stopAtFirstPositional: cmd?.stopAtFirstPositional,
      });
      const compiledArgs = cmd
        ? compileArgs(cmd.argTokens, cmd.args)
        : undefined;

      tree.attachCompiled(node, {
        args: compiledArgs?.descriptors ?? EMPTY_DESCRIPTORS,
        localFlags: localDescriptors,
        builtinFlags: builtins.descriptors,
      });

      runtimes.set(node, {
        userFlags,
        knownFlagNames:
          builtins.names.length > 0
            ? [...userFlags.knownNames, ...builtins.names]
            : userFlags.knownNames,
        parser,
        args: compiledArgs,
        hasBuiltinHelp: builtins.hasHelp,
        hasBuiltinVersion: builtins.hasVersion,
        hasBuiltinQuiet: builtins.hasQuiet,
        hasBuiltinVerbose: builtins.hasVerbose,
      });
    }

    let defaultNode: CommandNode | undefined;
    let defaultAcceptsArgs = false;
    if (this.#defaultCommand !== undefined) {
      const trimmedDefault = this.#defaultCommand.trim();
      if (trimmedDefault === "") {
        throw new InvalidCommandError(
          "defaultCommand cannot be empty; register a root command with cli.command({ ... }) instead",
        );
      }
      if (tree.root.command) {
        throw new InvalidCommandError(
          "cannot specify defaultCommand when a root command is already registered",
        );
      }
      const target = tree.findNode(trimmedDefault.split(/\s+/));
      if (!target?.command?.run) {
        throw new InvalidCommandError(
          `defaultCommand "${trimmedDefault}" does not match a runnable command`,
        );
      }
      defaultNode = target;
      defaultAcceptsArgs =
        target.args.length > 0 ||
        target.command.argTokens.includes(DOUBLE_DASH);
    }

    const model: CliModel = {
      meta: this.#meta,
      tree,
      defaultCommand: defaultNode?.fullPath,
      globalFlags: globalFlags.entries,
      groups,
    };

    registeredMiddlewares.sort(
      (a, b) =>
        ENFORCE_RANK[a.enforce ?? "normal"] -
        ENFORCE_RANK[b.enforce ?? "normal"],
    );

    this.#compiled = {
      model,
      tree,
      defaultNode,
      defaultAcceptsArgs,
      middlewares: registeredMiddlewares.map((m) => m.fn),
      errorHandlers,
      rootRuntime: runtimes.get(tree.root)!,
      runtimes,
    };

    return this.#compiled;
  }

  public buildModel(): CliModel {
    return this.#ensureCompiled().model;
  }

  #createContext(
    compiledCli: CompiledCli,
    argv: readonly string[] | undefined,
    options: RunOptions,
  ): InternalContext<TGlobalFlags, TState> {
    const terminal = options.terminal ?? createTerminal();
    const themeOverrides =
      this.#themeOverrides || options.theme
        ? { ...this.#themeOverrides, ...options.theme }
        : undefined;
    const theme = createTheme(terminal.color, themeOverrides);
    const log = createLogger({
      terminal,
      theme,
      ...this.#loggerOptions,
      ...options.logger,
    });
    const helpOpts =
      this.#helpOptions === false ? undefined : this.#helpOptions;
    const render = async (commandPath?: readonly string[]): Promise<string> => {
      if (helpOpts?.render) {
        return helpOpts.render(compiledCli.model, commandPath);
      }

      return renderHelp(compiledCli.model, {
        node: commandPath
          ? compiledCli.model.tree.findNode(commandPath)
          : compiledCli.model.tree.root,
        theme,
        columns: terminal.columns,
        unicode: terminal.unicode,
        header: helpOpts?.header,
        footer: helpOpts?.footer,
        sections: helpOpts?.sections,
      });
    };

    return {
      model: compiledCli.model,
      terminal,
      log,
      help: {
        render,
        print: async (commandPath?: readonly string[]) => {
          terminal.stdout(await render(commandPath));
        },
      },
      run: (nextArgv, nextOptions) => this.run(nextArgv, nextOptions),
      commandPath: [],
      args: {},
      flags: {} as any,
      state: {},
      raw: {
        argv: argv ?? terminal.argv,
        unknown: {},
        doubleDash: [],
      },
    };
  }

  async #execute(
    compiledCli: CompiledCli,
    ctx: InternalContext<TGlobalFlags, TState>,
  ): Promise<RunResult> {
    // 1. Resolve command match (matched | namespace | empty | unknown)
    let match = compiledCli.tree.resolveArgv(
      ctx.raw.argv,
      compiledCli.rootRuntime.parser.scan,
    );

    let rootParsed: ArgvParseResult | undefined;
    function isRootBuiltinRequest(): boolean {
      if (match.kind !== "empty") {
        return false;
      }
      rootParsed ??= compiledCli.rootRuntime.parser.parse(match.remainingArgv);

      return (
        (compiledCli.rootRuntime.hasBuiltinVersion &&
          rootParsed.flags.version === true) ||
        (compiledCli.rootRuntime.hasBuiltinHelp &&
          rootParsed.flags.help === true)
      );
    }

    if (
      compiledCli.defaultNode?.command &&
      ((match.kind === "empty" && !isRootBuiltinRequest()) ||
        (match.kind === "unknown" &&
          match.parentPath.length === 0 &&
          compiledCli.defaultAcceptsArgs))
    ) {
      match = {
        kind: "matched",
        node: compiledCli.defaultNode,
        command: compiledCli.defaultNode.command,
        calledAs: compiledCli.defaultNode.fullPath.join(" "),
        remainingArgv: match.remainingArgv,
      };
    }

    ctx.commandPath = match.node.fullPath;
    if (match.kind === "matched") {
      ctx.command = match.command;
      ctx.calledAs = match.calledAs;
    }

    // 2. Parse raw argv into flags & positionals
    const runtime =
      compiledCli.runtimes.get(match.node) ?? compiledCli.rootRuntime;
    const parsed =
      match.node === compiledCli.tree.root && rootParsed
        ? rootParsed
        : runtime.parser.parse(match.remainingArgv);
    ctx.raw.unknown = parsed.unknown;
    ctx.raw.doubleDash = parsed.doubleDash;

    if (runtime.hasBuiltinQuiet && parsed.flags.quiet === true) {
      ctx.log.level = "error";
    } else if (
      runtime.hasBuiltinVerbose &&
      typeof parsed.flags.verbose === "number" &&
      parsed.flags.verbose > 0
    ) {
      ctx.log.level = "debug";
    }

    // 3. Built-in --version, explicit --help, and unknown command handling
    if (match.kind === "unknown") {
      throw new UnknownCommandError(match.commandName, match.parentPath);
    }

    if (runtime.hasBuiltinVersion && parsed.flags.version === true) {
      ctx.terminal.stdout(formatCliVersion(ctx.model.meta));

      return { ok: true, exitCode: 0 };
    }

    if (runtime.hasBuiltinHelp && parsed.flags.help === true) {
      await ctx.help.print(match.node.fullPath);

      return { ok: true, exitCode: 0 };
    }

    // 4. Validate flag syntax before implicit root/namespace help or command execution
    validateParsedFlags(
      runtime.userFlags,
      runtime.knownFlagNames,
      parsed,
      this.#strictFlags,
    );

    if (match.kind !== "matched") {
      if (this.#helpOptions !== false) {
        await ctx.help.print(match.node.fullPath);

        return { ok: true, exitCode: 0 };
      }

      throw match.kind === "empty"
        ? new NoCommandError()
        : new UnknownCommandError(
            match.node.fullPath.join(" "),
            match.node.fullPath,
          );
    }

    // 5. Resolve typed flags & args, warn deprecations, and enforce constraints

    const { flags, missingRequired, provided } = await resolveCompiledFlags(
      runtime.userFlags,
      parsed.flags,
      parsed.provided,
      ctx.terminal.env,
    );
    ctx.flags = flags as any;

    const matchedCommand = match.command;
    const isStandalone =
      Boolean(matchedCommand.standalone) || Boolean(matchedCommand.builtin);

    validateResolvedFlags(
      runtime.userFlags,
      isStandalone ? [] : missingRequired,
      provided,
    );

    ctx.args = await executeCompiledArgs(
      runtime.args!,
      parsed.positionals,
      parsed.doubleDash,
      ctx.terminal.env,
    );

    const runCtx = ctx as unknown as RunContext<TGlobalFlags, TState>;

    async function runCore(): Promise<void> {
      if (matchedCommand.deprecated) {
        const reason =
          typeof matchedCommand.deprecated === "string"
            ? `: ${matchedCommand.deprecated}`
            : "";
        const commandLabel = ctx.commandPath.join(" ") || ctx.model.meta.name;
        ctx.log.warn(`Command '${commandLabel}' is deprecated${reason}`);
      }
      warnFlagDeprecations(runtime.userFlags, provided, ctx.log.warn);
      if (matchedCommand.run) {
        await matchedCommand.run(runCtx as any);
      }
    }

    // 6. Run onion middleware chain wrapping command execution
    if (isStandalone || compiledCli.middlewares.length === 0) {
      await runCore();
    } else {
      async function dispatch(
        index: number,
        added?: Record<string, any>,
      ): Promise<any> {
        if (added) {
          Object.assign(ctx.state, added);
        }
        const mw = compiledCli.middlewares[index];
        await (mw
          ? mw(runCtx, ((next?: Record<string, any>) =>
              dispatch(index + 1, next)) as MiddlewareNext)
          : runCore());
      }
      await dispatch(0);
    }

    return { ok: true, exitCode: 0 };
  }

  async #handleError(
    error: unknown,
    compiledCli: CompiledCli,
    ctx: InternalContext<TGlobalFlags, TState>,
    throwOnError: boolean,
  ): Promise<RunResult> {
    enrichCommandError(error, compiledCli.tree);

    const exitCode = error instanceof ClercError ? error.exitCode : 1;
    const errCtx = ctx as unknown as ErrorContext<TGlobalFlags, TState>;

    for (let i = compiledCli.errorHandlers.length - 1; i >= 0; i--) {
      if (await compiledCli.errorHandlers[i](error, errCtx)) {
        return { ok: false, exitCode, error };
      }
    }

    if (throwOnError) {
      throw error;
    }

    if (ctx.log.format === "json") {
      ctx.terminal.stderr(formatJsonError(error));
    } else {
      const verbose =
        ctx.log.level === "debug" ||
        Boolean(ctx.terminal.env.DEBUG && ctx.terminal.env.DEBUG !== "0");
      ctx.terminal.stderr(
        formatDiagnostic(error, {
          theme: ctx.log.theme,
          name: ctx.model.meta.name,
          commandPath: ctx.commandPath,
          verbose,
          showHelpHint: this.#helpOptions !== false,
        }),
      );
    }

    return { ok: false, exitCode, error };
  }

  public async run(
    argv?: readonly string[],
    options: RunOptions = {},
  ): Promise<RunResult> {
    const compiledCli = this.#ensureCompiled();
    const ctx = this.#createContext(compiledCli, argv, options);

    try {
      return await this.#execute(compiledCli, ctx);
    } catch (caughtError) {
      return this.#handleError(
        caughtError,
        compiledCli,
        ctx,
        options.throwOnError ?? false,
      );
    }
  }

  public async runMain(
    argv?: readonly string[],
    options?: RunOptions,
  ): Promise<RunResult> {
    const result = await this.run(argv, options);
    if (!result.ok) {
      process.exitCode = result.exitCode;
    }

    return result;
  }
}

export const plugin = (name: string): Plugin => new Plugin(name);

export const clerc = (options: ClercOptions): Clerc => new Clerc(options);
