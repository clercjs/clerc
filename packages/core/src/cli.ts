import { createParser } from "@clerc/parser";

import type { CompiledArgs } from "./args";
import { compileArgs, executeCompiledArgs, parseCommandSpec } from "./args";
import { CommandTree } from "./command-tree";
import {
  ClercError,
  MissingRequiredMetadataError,
  NoCommandError,
  UnknownCommandError,
  enrichCommandError,
  formatDiagnostic,
  formatJsonError,
} from "./errors";
import type { CompiledFlags } from "./flags";
import {
  compileFlags,
  resolveCompiledFlags,
  validateCompiledFlags,
  warnFlagDeprecations,
} from "./flags";
import { renderHelp } from "./help/renderer";
import type { LoggerOptions } from "./logger";
import { createLogger } from "./logger";
import { createTerminal } from "./terminal";
import type { ThemeStyleMap } from "./theme";
import { createTheme } from "./theme";
import type {
  AnyCommandDefinition,
  ArgDefinitionValue,
  ClercFlagsDefinition,
  CommandOptions,
  CreateCliOptions,
  ErrorHandler,
  ExtractArgNames,
  GroupDefinition,
  GroupsInput,
  HelpOptions,
  Middleware,
  ReadonlyCliMeta,
  ReadonlyCliModel,
  RunContext,
  RunOptions,
  RunResult,
} from "./types";
import { formatVersion } from "./utils";

type GroupScope = keyof GroupsInput;
type GroupBuckets = Record<GroupScope, GroupDefinition[]>;
type ContextExtender = (
  ctx: RunContext<any>,
) => Record<string, any> | Promise<Record<string, any>>;

interface CompiledCommand {
  readonly flags: CompiledFlags;
  readonly parser: ReturnType<typeof createParser>;
  readonly args?: CompiledArgs;
}

interface CompiledCli {
  readonly model: ReadonlyCliModel;
  readonly tree: CommandTree;
  readonly extenders: readonly ContextExtender[];
  readonly middlewares: readonly Middleware<any, any>[];
  readonly errorHandlers: readonly ErrorHandler<any, any>[];
  readonly builtinFlags: readonly string[];
  readonly global: CompiledCommand;
  readonly commands: WeakMap<AnyCommandDefinition, CompiledCommand>;
}

const GROUP_SCOPES: readonly GroupScope[] = [
  "commands",
  "flags",
  "globalFlags",
];

const HELP_FLAG = {
  type: Boolean,
  short: "h",
  description: "Show help",
} as const;

const VERSION_FLAG = {
  type: Boolean,
  short: "V",
  description: "Show version",
} as const;

const createGroupBuckets = (): GroupBuckets => ({
  commands: [],
  flags: [],
  globalFlags: [],
});

const formatCliVersion = (meta: ReadonlyCliMeta): string =>
  `${meta.scriptName} ${formatVersion(meta.version)}`.trim();

function collectScope(
  scope: Plugin<any, any>,
  globalFlags: ClercFlagsDefinition,
  commands: AnyCommandDefinition[],
  groups: GroupBuckets,
  extenders: ContextExtender[],
  middlewares: Middleware<any, any>[],
  errorHandlers: ErrorHandler<any, any>[],
): void {
  for (const child of scope._plugins.values()) {
    collectScope(
      child,
      globalFlags,
      commands,
      groups,
      extenders,
      middlewares,
      errorHandlers,
    );
  }

  Object.assign(globalFlags, scope._flags);
  commands.push(...scope._commands);
  extenders.push(...scope._extenders);
  middlewares.push(...scope._middlewares);
  errorHandlers.push(...scope._errorHandlers);

  for (const groupScope of GROUP_SCOPES) {
    groups[groupScope].push(...scope._groups[groupScope]);
  }
}

export class Plugin<
  TGlobalFlags extends ClercFlagsDefinition = {},
  TExt extends Record<string, any> = {},
> {
  public readonly pluginName: string;

  /**
   * @internal
   */
  public readonly _flags: ClercFlagsDefinition = {};
  /**
   * @internal
   */
  public readonly _commands: AnyCommandDefinition[] = [];
  /**
   * @internal
   */
  public readonly _groups: GroupBuckets = createGroupBuckets();
  /**
   * @internal
   */
  public readonly _extenders: ContextExtender[] = [];
  /**
   * @internal
   */
  public readonly _middlewares: Middleware<any, any>[] = [];
  /**
   * @internal
   */
  public readonly _errorHandlers: ErrorHandler<any, any>[] = [];
  /**
   * @internal
   */
  public readonly _plugins = new Map<string, Plugin<any, any>>();

  constructor(name: string) {
    this.pluginName = name;
  }

  protected _invalidate(): void {
    // Overridden by CliApp to clear compiled state
  }

  public flags<const Flags extends ClercFlagsDefinition>(
    definitions: Flags,
  ): Plugin<TGlobalFlags & Flags, TExt> {
    Object.assign(this._flags, definitions);
    this._invalidate();

    return this as any;
  }

  public groups(definitions: GroupsInput): this {
    for (const scope of GROUP_SCOPES) {
      const entries = definitions[scope];
      if (!entries) {
        continue;
      }
      for (const [key, title] of Object.entries(entries)) {
        this._groups[scope].push({ key, title });
      }
    }
    this._invalidate();

    return this;
  }

  public command<
    const Spec extends string,
    const Args extends Partial<
      Record<ExtractArgNames<Spec>, ArgDefinitionValue>
    > = {},
    const Flags extends ClercFlagsDefinition = {},
  >(
    spec: Spec,
    options?: CommandOptions<Spec, Args, Flags, TGlobalFlags, TExt>,
  ): this {
    const { name, argTokens } = parseCommandSpec(spec);
    this._commands.push({ ...options, spec, name, argTokens });
    this._invalidate();

    return this;
  }

  public extend<Added extends Record<string, any>>(
    fn: (ctx: RunContext<TGlobalFlags> & TExt) => Added | Promise<Added>,
  ): Plugin<TGlobalFlags, TExt & Added> {
    this._extenders.push(fn as ContextExtender);
    this._invalidate();

    return this as any;
  }

  public middleware(fn: Middleware<TGlobalFlags, TExt>): this {
    this._middlewares.push(fn as Middleware<any, any>);
    this._invalidate();

    return this;
  }

  public onError(fn: ErrorHandler<TGlobalFlags, TExt>): this {
    this._errorHandlers.push(fn as ErrorHandler<any, any>);
    this._invalidate();

    return this;
  }

  public use<
    PFlags extends ClercFlagsDefinition = {},
    PExt extends Record<string, any> = {},
  >(other: Plugin<PFlags, PExt>): Plugin<TGlobalFlags & PFlags, TExt & PExt> {
    this._plugins.set(other.pluginName, other);
    this._invalidate();

    return this as any;
  }
}

export class CliApp<
  TGlobalFlags extends ClercFlagsDefinition = {},
  TExt extends Record<string, any> = {},
> extends Plugin<TGlobalFlags, TExt> {
  readonly #meta: ReadonlyCliMeta;
  readonly #helpOptions: false | HelpOptions;
  readonly #strictFlags: boolean;
  readonly #themeOverrides?: Partial<ThemeStyleMap>;
  readonly #loggerOptions?: LoggerOptions;
  #compiled?: CompiledCli;

  constructor(options: CreateCliOptions = {}) {
    super("clerc:root");
    this.#meta = {
      scriptName: options.scriptName ?? "",
      description: options.description ?? "",
      version: options.version ?? "",
      examples: options.examples,
      notes: options.notes,
    };
    this.#helpOptions =
      options.help === false
        ? false
        : typeof options.help === "object"
          ? options.help
          : {};
    this.#strictFlags = options.strictFlags ?? true;
    this.#themeOverrides = options.theme;
    this.#loggerOptions = options.logger;
  }

  protected override _invalidate(): void {
    this.#compiled = undefined;
  }

  public override flags<const Flags extends ClercFlagsDefinition>(
    definitions: Flags,
  ): CliApp<TGlobalFlags & Flags, TExt> {
    super.flags(definitions);

    return this as any;
  }

  public override extend<Added extends Record<string, any>>(
    fn: (ctx: RunContext<TGlobalFlags> & TExt) => Added | Promise<Added>,
  ): CliApp<TGlobalFlags, TExt & Added> {
    super.extend(fn);

    return this as any;
  }

  public override use<
    PFlags extends ClercFlagsDefinition = {},
    PExt extends Record<string, any> = {},
  >(other: Plugin<PFlags, PExt>): CliApp<TGlobalFlags & PFlags, TExt & PExt> {
    super.use(other);

    return this as any;
  }

  public disable(pluginName: string): this {
    if (this._plugins.delete(pluginName)) {
      this._invalidate();
    }

    return this;
  }

  #ensureCompiled(): CompiledCli {
    if (this.#compiled) {
      return this.#compiled;
    }

    const globalFlagsDef: ClercFlagsDefinition = {};
    const commands: AnyCommandDefinition[] = [];
    const groups = createGroupBuckets();
    const extenders: ContextExtender[] = [];
    const middlewares: Middleware<any, any>[] = [];
    const errorHandlers: ErrorHandler<any, any>[] = [];

    collectScope(
      this,
      globalFlagsDef,
      commands,
      groups,
      extenders,
      middlewares,
      errorHandlers,
    );

    const builtinFlags: string[] = [];
    if (this.#meta.version && !("version" in globalFlagsDef)) {
      globalFlagsDef.version = VERSION_FLAG;
      builtinFlags.push("version");
    }
    if (this.#helpOptions !== false && !("help" in globalFlagsDef)) {
      globalFlagsDef.help = HELP_FLAG;
      builtinFlags.push("help");
    }

    const tree = new CommandTree();
    for (const cmd of commands) {
      tree.register(cmd);
    }

    // Register built-in version & help subcommands unless overridden by user
    if (this.#meta.version && !tree.findNode(["version"])) {
      tree.register({
        spec: "version",
        name: "version",
        argTokens: [],
        description: "Show version",
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
        examples: (meta) => [
          [`$ ${meta.scriptName} help`, "Show general help"],
          [`$ ${meta.scriptName} help <command>`, "Show help for a command"],
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

    const model: ReadonlyCliModel = {
      meta: this.#meta,
      tree,
      globalFlags: globalFlagsDef,
      groups,
    };

    const globalFlags = compileFlags(globalFlagsDef);
    this.#compiled = {
      model,
      tree,
      extenders,
      middlewares,
      errorHandlers,
      builtinFlags,
      global: {
        flags: globalFlags,
        parser: createParser({ flags: globalFlags.parserFlags }),
      },
      commands: new WeakMap(),
    };

    return this.#compiled;
  }

  public buildModel(): ReadonlyCliModel {
    return this.#ensureCompiled().model;
  }

  #compileCommand(
    cli: CompiledCli,
    cmd?: AnyCommandDefinition,
  ): CompiledCommand {
    if (!cmd) {
      return cli.global;
    }

    const cached = cli.commands.get(cmd);
    if (cached) {
      return cached;
    }

    const hasLocalFlags = cmd.flags !== undefined;
    const flags = hasLocalFlags
      ? compileFlags({ ...cli.model.globalFlags, ...cmd.flags })
      : cli.global.flags;
    const parser =
      !hasLocalFlags && !cmd.ignore
        ? cli.global.parser
        : createParser({ flags: flags.parserFlags, ignore: cmd.ignore });
    const compiled: CompiledCommand = {
      flags,
      parser,
      args:
        cmd.argTokens.length > 0
          ? compileArgs(cmd.argTokens, cmd.args)
          : undefined,
    };
    cli.commands.set(cmd, compiled);

    return compiled;
  }

  #createContext(
    compiledCli: CompiledCli,
    argv: readonly string[] | undefined,
    options: RunOptions,
  ): RunContext<TGlobalFlags> & TExt {
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
        header: helpOpts?.header,
        footer: helpOpts?.footer,
      });
    };

    const baseCtx: RunContext<TGlobalFlags> = {
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
      argv: argv ?? terminal.argv,
      commandPath: [],
      args: {},
      flags: {} as any,
      unknown: {},
      ignored: [],
      doubleDash: [],
    };

    return baseCtx as RunContext<TGlobalFlags> & TExt;
  }

  async #execute(
    compiledCli: CompiledCli,
    ctx: RunContext<TGlobalFlags> & TExt,
  ): Promise<RunResult> {
    if (!ctx.meta.scriptName) {
      throw new MissingRequiredMetadataError("scriptName");
    }
    if (!ctx.meta.version) {
      throw new MissingRequiredMetadataError("version");
    }

    // 1. Resolve command match (matched | namespace | empty | unknown)
    const match = compiledCli.tree.resolveArgv(
      ctx.argv,
      compiledCli.global.parser.scan,
    );
    ctx.commandPath = match.node.fullPath;
    if (match.kind === "matched") {
      ctx.command = match.command;
      ctx.calledAs = match.calledAs;
    }

    // 2. Lexically parse flags & positionals
    const compiledCmd = this.#compileCommand(compiledCli, ctx.command);
    const parsed = compiledCmd.parser.parse(match.remainingArgv);
    ctx.flags = parsed.flags as any;
    ctx.unknown = parsed.unknown;
    ctx.ignored = parsed.ignored;
    ctx.doubleDash = parsed.doubleDash;

    // 3. Built-in --version and --help handling (unless shadowed by local flags)
    if (
      this.#meta.version &&
      !ctx.command?.flags?.version &&
      parsed.flags.version === true &&
      match.node.fullPath.length === 0 &&
      match.kind !== "unknown"
    ) {
      ctx.terminal.stdout(formatCliVersion(ctx.meta));

      return { ok: true, exitCode: 0 };
    }

    if (this.#helpOptions !== false) {
      const wantsHelp =
        !ctx.command?.flags?.help &&
        parsed.flags.help === true &&
        match.kind !== "unknown";
      const implicitHelp = match.kind === "empty" || match.kind === "namespace";

      if (wantsHelp || implicitHelp) {
        await ctx.help.print(match.node.fullPath);

        return { ok: true, exitCode: 0 };
      }
    }

    // 4. Require a matched command
    if (match.kind !== "matched") {
      throw match.kind === "unknown"
        ? new UnknownCommandError(match.commandName, match.parentPath)
        : match.kind === "namespace"
          ? new UnknownCommandError(
              match.node.fullPath.join(" "),
              match.node.fullPath,
            )
          : new NoCommandError();
    }

    // 5. Resolve flags, warn deprecations, validate flags & args
    const { flags, missingRequired, provided } = await resolveCompiledFlags(
      compiledCmd.flags,
      parsed.flags,
      parsed.provided,
      ctx.terminal.env,
    );
    const localFlags = match.command.flags;
    for (const builtin of compiledCli.builtinFlags) {
      if (!localFlags || !(builtin in localFlags)) {
        delete flags[builtin];
      }
    }
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
    warnFlagDeprecations(compiledCmd.flags, provided, ctx.log.warn);

    validateCompiledFlags(
      compiledCmd.flags,
      missingRequired,
      provided,
      parsed.unknown,
      this.#strictFlags,
    );

    ctx.args = compiledCmd.args
      ? await executeCompiledArgs(
          compiledCmd.args,
          parsed.parameters,
          parsed.doubleDash,
        )
      : {};

    // 6. Derive async context extensions with resolved flags & args
    for (const extend of compiledCli.extenders) {
      Object.assign(ctx, await extend(ctx));
    }

    // 7. Run onion middleware chain wrapping command.run
    const dispatch = async (index: number): Promise<void> => {
      const mw = compiledCli.middlewares[index];
      if (mw) {
        await mw(ctx, () => dispatch(index + 1));
      } else if (ctx.command?.run) {
        await ctx.command.run(ctx as any);
      }
    };
    await dispatch(0);

    return { ok: true, exitCode: 0 };
  }

  async #handleError(
    error: unknown,
    compiledCli: CompiledCli,
    ctx: RunContext<TGlobalFlags> & TExt,
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
          scriptName: ctx.meta.scriptName,
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

export const createCli = (options?: CreateCliOptions): CliApp =>
  new CliApp(options);
