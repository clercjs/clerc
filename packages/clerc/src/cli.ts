import type { LoggerOptions } from "@clerc/logger";
import { createLogger } from "@clerc/logger";
import type { ThemeStyleMap } from "@clerc/theme";
import { createTheme } from "@clerc/theme";

import type { CompiledArgs } from "./args";
import { compileArgs, executeCompiledArgs, parseCommandSpec } from "./args";
import type { CommandMatch } from "./command-tree";
import { CommandTreeBuilder } from "./command-tree";
import {
  ClercError,
  InvalidCommandError,
  MissingRequiredMetadataError,
  NoCommandError,
  UnexpectedArgumentError,
  UnknownCommandError,
  enrichCommandError,
  formatDiagnostic,
  formatJsonError,
} from "./errors";
import type { CompiledFlags } from "./flags";
import {
  compileFlags,
  createBuiltinFlagDescriptor,
  finalizeCompiledFlags,
  mergeCompiledFlags,
  resolveCompiledFlags,
  validateParsedFlags,
  validateResolvedFlags,
  warnFlagDeprecations,
} from "./flags";
import { renderHelp } from "./help/renderer";
import type { ArgvFlagSpec, ArgvParser } from "./parser";
import { DOUBLE_DASH, createArgvParser } from "./parser";
import { createTerminal } from "./terminal";
import type {
  AnyCommandDefinition,
  ClercOptions,
  CliMeta,
  CliModel,
  CommandNode,
  CommandOptions,
  ContextualFlags,
  ErrorContext,
  ErrorHandler,
  ExtractArgNames,
  FlagDescriptor,
  FlagsDefinition,
  GroupDefinition,
  GroupsInput,
  HelpOptions,
  Middleware,
  NonEmptySpec,
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
  TExt extends Record<string, any>,
> = Mutable<ErrorContext<TGlobalFlags>> & Partial<TExt>;
type ContextExtender = (
  ctx: RunContext<any>,
) => Record<string, any> | Promise<Record<string, any>>;

interface PluginState {
  readonly flags: FlagsDefinition;
  readonly commands: AnyCommandDefinition[];
  readonly groups: GroupBuckets;
  readonly extenders: ContextExtender[];
  readonly middlewares: Middleware<any, any>[];
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
}

interface CompiledCli {
  readonly model: CliModel;
  readonly tree: CommandTreeBuilder;
  readonly defaultNode?: CommandNode;
  readonly defaultAcceptsArgs: boolean;
  readonly extenders: readonly ContextExtender[];
  readonly middlewares: readonly Middleware<any, any>[];
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

const pluginStates = new WeakMap<Plugin<any, any>, PluginState>();

function getPluginState(instance: Plugin<any, any>): PluginState {
  const state = pluginStates.get(instance);
  if (!state) {
    throw new Error("Invalid Plugin instance");
  }

  return state;
}

const createGroupBuckets = (): GroupBuckets => ({
  commands: [],
  flags: [],
  globalFlags: [],
});

const formatCliVersion = (meta: CliMeta): string =>
  `${meta.name} ${formatVersion(meta.version)}`.trim();

interface ScopeCollector {
  readonly globalFlags: FlagsDefinition;
  readonly commands: AnyCommandDefinition[];
  readonly groups: GroupBuckets;
  readonly extenders: ContextExtender[];
  readonly middlewares: Middleware<any, any>[];
  readonly errorHandlers: ErrorHandler<any, any>[];
}

function collectScope(
  scope: Plugin<any, any>,
  acc: ScopeCollector,
  visited = new Set<string>(),
): void {
  if (visited.has(scope.pluginName)) {
    return;
  }
  visited.add(scope.pluginName);

  const state = getPluginState(scope);
  for (const child of state.plugins.values()) {
    collectScope(child, acc, visited);
  }

  Object.assign(acc.globalFlags, state.flags);
  acc.commands.push(...state.commands);
  acc.extenders.push(...state.extenders);
  acc.middlewares.push(...state.middlewares);
  acc.errorHandlers.push(...state.errorHandlers);

  for (const groupScope of GROUP_SCOPES) {
    acc.groups[groupScope].push(...state.groups[groupScope]);
  }
}

function createUnmatchedError(
  match: Exclude<CommandMatch, { readonly kind: "matched" }>,
): ClercError {
  switch (match.kind) {
    case "unknown": {
      return new UnknownCommandError(match.commandName, match.parentPath);
    }
    case "namespace": {
      return new UnknownCommandError(
        match.node.fullPath.join(" "),
        match.node.fullPath,
      );
    }
    case "empty": {
      return new NoCommandError();
    }
  }
}

function resolveNodeBuiltins(options: {
  readonly isRoot: boolean;
  readonly enableVersion: boolean;
  readonly enableHelp: boolean;
  readonly userFlags: CompiledFlags;
}): {
  readonly descriptors: readonly FlagDescriptor[];
  readonly specs: readonly ArgvFlagSpec[];
  readonly names: readonly string[];
  readonly hasHelp: boolean;
  readonly hasVersion: boolean;
} {
  const { isRoot, enableVersion, enableHelp, userFlags } = options;
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
  let hasVersion = false;
  let hasHelp = false;

  if (isRoot && enableVersion && !usedNames.has("version")) {
    const short = usedShorts.has("V") ? undefined : "V";
    if (short) {
      usedShorts.add(short);
    }
    descriptors.push(
      createBuiltinFlagDescriptor("version", short, "Show version"),
    );
    specs.push({ key: "version", kind: "boolean", short, negatable: false });
    names.push("version");
    hasVersion = true;
  }

  if (enableHelp && !usedNames.has("help")) {
    const short = usedShorts.has("h") ? undefined : "h";
    descriptors.push(createBuiltinFlagDescriptor("help", short, "Show help"));
    specs.push({ key: "help", kind: "boolean", short, negatable: false });
    names.push("help");
    hasHelp = true;
  }

  return { descriptors, specs, names, hasHelp, hasVersion };
}

export class Plugin<
  TGlobalFlags extends Record<string, any> = {},
  TExt extends Record<string, any> = {},
> {
  public readonly pluginName: string;

  constructor(name: string) {
    this.pluginName = name;
    pluginStates.set(this, {
      flags: {},
      commands: [],
      groups: createGroupBuckets(),
      extenders: [],
      middlewares: [],
      errorHandlers: [],
      plugins: new Map(),
    });
  }

  public flags<const Flags extends Record<string, any>>(
    definitions: ContextualFlags<Flags>,
  ): Plugin<TGlobalFlags & Flags, TExt> {
    const state = getPluginState(this);
    Object.assign(state.flags, definitions);
    state.onInvalidate?.();

    return this as any;
  }

  public groups(definitions: GroupsInput): this {
    const state = getPluginState(this);
    for (const scope of GROUP_SCOPES) {
      const entries = definitions[scope];
      if (!entries) {
        continue;
      }
      for (const [key, title] of Object.entries(entries)) {
        state.groups[scope].push({ key, title });
      }
    }
    state.onInvalidate?.();

    return this;
  }

  public command<const Flags extends Record<string, any> = {}>(
    options: RootCommandOptions<Flags, TGlobalFlags, TExt>,
  ): this;
  public command<
    const Spec extends string,
    const Args extends Partial<Record<ExtractArgNames<Spec>, any>> = {},
    const Flags extends Record<string, any> = {},
  >(
    spec: NonEmptySpec<Spec>,
    options?: CommandOptions<Spec, Args, Flags, TGlobalFlags, TExt>,
  ): this;
  public command(
    specOrOptions: string | RootCommandOptions<any, any, any>,
    maybeOptions?: CommandOptions<any, any, any, any, any>,
  ): this {
    const state = getPluginState(this);
    if (typeof specOrOptions === "string") {
      const { name, argTokens } = parseCommandSpec(specOrOptions);
      state.commands.push({
        ...maybeOptions,
        spec: specOrOptions,
        name,
        argTokens,
      });
    } else {
      state.commands.push({
        ...specOrOptions,
        spec: "",
        name: "",
        argTokens: [],
      });
    }
    state.onInvalidate?.();

    return this;
  }

  public extend<Added extends Record<string, any>>(
    fn: (ctx: RunContext<TGlobalFlags> & TExt) => Added | Promise<Added>,
  ): Plugin<TGlobalFlags, TExt & Added> {
    const state = getPluginState(this);
    state.extenders.push(fn as ContextExtender);
    state.onInvalidate?.();

    return this as any;
  }

  public middleware(fn: Middleware<TGlobalFlags, TExt>): this {
    const state = getPluginState(this);
    state.middlewares.push(fn as Middleware<any, any>);
    state.onInvalidate?.();

    return this;
  }

  public onError(fn: ErrorHandler<TGlobalFlags, TExt>): this {
    const state = getPluginState(this);
    state.errorHandlers.push(fn as ErrorHandler<any, any>);
    state.onInvalidate?.();

    return this;
  }

  public use<
    PFlags extends Record<string, any> = {},
    PExt extends Record<string, any> = {},
  >(other: Plugin<PFlags, PExt>): Plugin<TGlobalFlags & PFlags, TExt & PExt> {
    const state = getPluginState(this);
    state.plugins.set(other.pluginName, other);
    state.onInvalidate?.();

    return this as any;
  }
}

export class Clerc<
  TGlobalFlags extends Record<string, any> = {},
  TExt extends Record<string, any> = {},
> extends Plugin<TGlobalFlags, TExt> {
  readonly #meta: CliMeta;
  readonly #defaultCommand?: string;
  readonly #helpOptions: false | HelpOptions;
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
    this.#strictFlags = options.strictFlags ?? true;
    this.#themeOverrides = options.theme;
    this.#loggerOptions = options.logger;

    getPluginState(this).onInvalidate = () => {
      this.#compiled = undefined;
    };
  }

  public override flags<const Flags extends Record<string, any>>(
    definitions: ContextualFlags<Flags>,
  ): Clerc<TGlobalFlags & Flags, TExt> {
    super.flags(definitions);

    return this as any;
  }

  public override extend<Added extends Record<string, any>>(
    fn: (ctx: RunContext<TGlobalFlags> & TExt) => Added | Promise<Added>,
  ): Clerc<TGlobalFlags, TExt & Added> {
    super.extend(fn);

    return this as any;
  }

  public override use<
    PFlags extends Record<string, any> = {},
    PExt extends Record<string, any> = {},
  >(other: Plugin<PFlags, PExt>): Clerc<TGlobalFlags & PFlags, TExt & PExt> {
    super.use(other);

    return this as any;
  }

  public disable(pluginName: string): this {
    const state = getPluginState(this);
    if (state.plugins.delete(pluginName)) {
      this.#compiled = undefined;
    }

    return this;
  }

  #ensureCompiled(): CompiledCli {
    if (this.#compiled) {
      return this.#compiled;
    }

    const acc: ScopeCollector = {
      globalFlags: {},
      commands: [],
      groups: createGroupBuckets(),
      extenders: [],
      middlewares: [],
      errorHandlers: [],
    };
    collectScope(this, acc);

    const tree = new CommandTreeBuilder();
    for (const cmd of acc.commands) {
      tree.register(cmd);
    }

    if (this.#meta.version && !tree.findNode(["version"])) {
      tree.register({
        spec: "version",
        name: "version",
        argTokens: [],
        description: "Show version",
        builtin: true,
        run(ctx) {
          ctx.terminal.stdout(formatCliVersion(ctx.meta));
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
        examples: (meta) => [
          [`$ ${meta.name} help`, "Show general help"],
          [`$ ${meta.name} help <command>`, "Show help for a command"],
        ],
        async run(ctx) {
          const path = ctx.args.command as string[];
          if (path.length > 0 && !ctx.model.tree.findNode(path)) {
            throw new UnknownCommandError(path.join(" "), []);
          }
          await ctx.help.print(path.length > 0 ? path : undefined);
        },
      });
    }

    const rawGlobalFlags = compileFlags(acc.globalFlags);
    const globalFlags = finalizeCompiledFlags(rawGlobalFlags);
    const enableVersion = Boolean(this.#meta.version);
    const enableHelp = this.#helpOptions !== false;
    const runtimes = new Map<CommandNode, CompiledNodeRuntime>();

    for (const node of tree.walkNodes()) {
      const isRoot = node.fullPath.length === 0;
      const cmd = node.command;
      const localFlags = cmd?.flags ? compileFlags(cmd.flags) : undefined;
      const userFlags = localFlags
        ? finalizeCompiledFlags(mergeCompiledFlags(rawGlobalFlags, localFlags))
        : globalFlags;
      const localDescriptors = localFlags
        ? localFlags.entries.map((e) => userFlags.byName.get(e.name)!)
        : EMPTY_DESCRIPTORS;
      const builtins = resolveNodeBuiltins({
        isRoot,
        enableVersion,
        enableHelp,
        userFlags,
      });

      const parser = createArgvParser([...userFlags.specs, ...builtins.specs], {
        stopAtFirstPositional: cmd?.stopAtFirstPositional,
      });
      const compiledArgs =
        cmd && cmd.argTokens.length > 0
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
        Boolean(target.command.argTokens.includes(DOUBLE_DASH));
    }

    const model: CliModel = {
      meta: this.#meta,
      tree,
      defaultCommand: defaultNode?.fullPath,
      globalFlags: globalFlags.descriptors,
      groups: acc.groups,
    };

    this.#compiled = {
      model,
      tree,
      defaultNode,
      defaultAcceptsArgs,
      extenders: acc.extenders,
      middlewares: acc.middlewares,
      errorHandlers: acc.errorHandlers,
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
  ): InternalContext<TGlobalFlags, TExt> {
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

    const baseCtx: Mutable<ErrorContext<TGlobalFlags>> = {
      meta: compiledCli.model.meta,
      model: compiledCli.model,
      terminal,
      theme,
      log,
      help: {
        render,
        print: async (commandPath?: readonly string[]) => {
          terminal.stdout(await render(commandPath));
        },
      },
      run: (nextArgv, nextOptions) => this.run(nextArgv, nextOptions),
      argv: argv ?? terminal.argv,
      commandPath: [],
      args: {},
      flags: {} as any,
      unknown: {},
      doubleDash: [],
    };

    return baseCtx as InternalContext<TGlobalFlags, TExt>;
  }

  async #execute(
    compiledCli: CompiledCli,
    ctx: InternalContext<TGlobalFlags, TExt>,
  ): Promise<RunResult> {
    // 1. Resolve command match (matched | namespace | empty | unknown)
    let match = compiledCli.tree.resolveArgv(
      ctx.argv,
      compiledCli.rootRuntime.parser.scan,
    );

    // Handle explicit root --version / --help before falling back to defaultCommand
    if (match.kind === "empty" && compiledCli.defaultNode) {
      const rootParsed = compiledCli.rootRuntime.parser.parse(
        match.remainingArgv,
      );
      if (
        compiledCli.rootRuntime.hasBuiltinVersion &&
        rootParsed.flags.version === true
      ) {
        ctx.terminal.stdout(formatCliVersion(ctx.meta));

        return { ok: true, exitCode: 0 };
      }
      if (
        this.#helpOptions !== false &&
        compiledCli.rootRuntime.hasBuiltinHelp &&
        rootParsed.flags.help === true
      ) {
        await ctx.help.print([]);

        return { ok: true, exitCode: 0 };
      }
    }

    if (
      compiledCli.defaultNode?.command &&
      (match.kind === "empty" ||
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
    const parsed = runtime.parser.parse(match.remainingArgv);
    ctx.unknown = parsed.unknown;
    ctx.doubleDash = parsed.doubleDash;

    // 3. Built-in --version and --help handling (only when active on target node)
    if (
      runtime.hasBuiltinVersion &&
      parsed.flags.version === true &&
      match.kind !== "unknown"
    ) {
      ctx.terminal.stdout(formatCliVersion(ctx.meta));

      return { ok: true, exitCode: 0 };
    }

    const hasParseErrors =
      (this.#strictFlags && Object.keys(parsed.unknown).length > 0) ||
      parsed.missingValueFlags.length > 0 ||
      parsed.invalidValues.length > 0;

    if (this.#helpOptions !== false) {
      const wantsHelp =
        runtime.hasBuiltinHelp &&
        parsed.flags.help === true &&
        match.kind !== "unknown";
      const implicitHelp =
        !hasParseErrors &&
        (match.kind === "empty" || match.kind === "namespace");

      if (wantsHelp || implicitHelp) {
        await ctx.help.print(match.node.fullPath);

        return { ok: true, exitCode: 0 };
      }
    }

    // 4. Validate flag syntax before requiring a matched command so invalid
    //    root/namespace flags report actionable errors instead of generic help
    if (match.kind !== "matched") {
      if (hasParseErrors) {
        validateParsedFlags(
          runtime.userFlags,
          runtime.knownFlagNames,
          parsed,
          this.#strictFlags,
        );
      }

      throw createUnmatchedError(match);
    }

    // 5. Validate syntax, resolve typed flags & args, warn deprecations, enforce constraints
    validateParsedFlags(
      runtime.userFlags,
      runtime.knownFlagNames,
      parsed,
      this.#strictFlags,
    );

    const { flags, missingRequired, provided } = await resolveCompiledFlags(
      runtime.userFlags,
      parsed.flags,
      parsed.provided,
      ctx.terminal.env,
    );
    ctx.flags = flags as any;

    const matchedCommand = match.command;
    if (matchedCommand.deprecated) {
      const reason =
        typeof matchedCommand.deprecated === "string"
          ? `: ${matchedCommand.deprecated}`
          : "";
      const pathLabel = ctx.commandPath.join(" ");
      ctx.log.warn(`Command '${pathLabel || "(root)"}' is deprecated${reason}`);
    }
    warnFlagDeprecations(runtime.userFlags, provided, ctx.log.warn);

    validateResolvedFlags(runtime.userFlags, missingRequired, provided);

    if (runtime.args) {
      ctx.args = await executeCompiledArgs(
        runtime.args,
        parsed.parameters,
        parsed.doubleDash,
        ctx.terminal.env,
      );
    } else {
      const extraArgs = [...parsed.parameters, ...parsed.doubleDash];
      if (extraArgs.length > 0) {
        throw new UnexpectedArgumentError(extraArgs);
      }
      ctx.args = {};
    }

    const runCtx = ctx as RunContext<TGlobalFlags> & TExt;

    // 6. Derive async context extensions with resolved flags & args
    for (const extend of compiledCli.extenders) {
      Object.assign(runCtx, await extend(runCtx));
    }

    // 7. Run onion middleware chain wrapping command.run
    if (compiledCli.middlewares.length === 0) {
      if (matchedCommand.run) {
        await matchedCommand.run(runCtx as any);
      }
    } else {
      const dispatch = async (index: number): Promise<void> => {
        const mw = compiledCli.middlewares[index];
        if (mw) {
          await mw(runCtx, () => dispatch(index + 1));
        } else if (matchedCommand.run) {
          await matchedCommand.run(runCtx as any);
        }
      };
      await dispatch(0);
    }

    return { ok: true, exitCode: 0 };
  }

  async #handleError(
    error: unknown,
    compiledCli: CompiledCli,
    ctx: InternalContext<TGlobalFlags, TExt>,
    throwOnError: boolean,
  ): Promise<RunResult> {
    enrichCommandError(error, compiledCli.tree);

    const exitCode = error instanceof ClercError ? error.exitCode : 1;

    for (let i = compiledCli.errorHandlers.length - 1; i >= 0; i--) {
      if (await compiledCli.errorHandlers[i](error, ctx)) {
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
          theme: ctx.theme,
          name: ctx.meta.name,
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
