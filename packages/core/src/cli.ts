import { createParser } from "@clerc/parser";

import type { CompiledArgs } from "./args";
import { compileArgs, executeCompiledArgs, parseCommandSpec } from "./args";
import type { ArgvResolution } from "./command-tree";
import { CommandTree } from "./command-tree";
import {
  ClercError,
  MissingRequiredFlagError,
  MissingRequiredMetadataError,
  NoCommandError,
  UnknownCommandError,
} from "./errors";
import type { CompiledFlags } from "./flags";
import {
  checkFlagConstraints,
  compileFlags,
  resolveCompiledFlags,
} from "./flags";
import type { LoggerOptions } from "./logger";
import { createLogger } from "./logger";
import { createTerminal } from "./terminal";
import type { ThemeStyleMap } from "./theme";
import { createTheme } from "./theme";
import type {
  AnyCommandDefinition,
  ArgDefinitionValue,
  BaseRunContext,
  ClercFlagsDefinition,
  CommandOptions,
  CreateCliOptions,
  ExtractArgNames,
  GroupDefinition,
  GroupsInput,
  HookHandlerMap,
  HookPhase,
  MetaAsyncGetter,
  ReadonlyCliMeta,
  ReadonlyCliModel,
  RunOptions,
  RunResult,
} from "./types";

interface HookEntry<K extends HookPhase = HookPhase> {
  readonly source?: string;
  readonly fn: HookHandlerMap<any, any>[K];
}

interface HookBuckets {
  intercept: HookEntry<"intercept">[];
  validate: HookEntry<"validate">[];
  beforeRun: HookEntry<"beforeRun">[];
  afterRun: HookEntry<"afterRun">[];
  error: HookEntry<"error">[];
  renderError: HookEntry<"renderError">[];
}

type ContextExtender = (ctx: BaseRunContext<any>) => Record<string, any>;

interface CompiledCommand {
  readonly flags: CompiledFlags;
  readonly parser: ReturnType<typeof createParser>;
  readonly args?: CompiledArgs;
}

interface CompiledCli {
  readonly model: ReadonlyCliModel;
  readonly tree: CommandTree;
  readonly extenders: readonly ContextExtender[];
  readonly hooks: HookBuckets;
  readonly global: CompiledCommand;
  readonly commands: WeakMap<AnyCommandDefinition, CompiledCommand>;
}

const createHookBuckets = (): HookBuckets => ({
  intercept: [],
  validate: [],
  beforeRun: [],
  afterRun: [],
  error: [],
  renderError: [],
});

const GROUP_SCOPES = ["commands", "flags", "globalFlags"] as const;

function createMissingCommandError(resolution: ArgvResolution): ClercError {
  if (resolution.matchedPath.length > 0) {
    const attempted = resolution.leadingPositional
      ? [...resolution.matchedPath, resolution.leadingPositional].join(" ")
      : resolution.matchedPath.join(" ");

    return new UnknownCommandError(attempted, resolution.matchedPath);
  }
  if (resolution.leadingPositional) {
    return new UnknownCommandError(resolution.leadingPositional, []);
  }

  return new NoCommandError();
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
  public readonly _groups = {
    commands: [] as GroupDefinition[],
    flags: [] as GroupDefinition[],
    globalFlags: [] as GroupDefinition[],
  };

  /**
   * @internal
   */
  public readonly _extenders: ContextExtender[] = [];
  /**
   * @internal
   */
  public readonly _hooks: HookBuckets = createHookBuckets();
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
    fn: (ctx: BaseRunContext<TGlobalFlags> & TExt) => Added,
  ): Plugin<TGlobalFlags, TExt & Added> {
    this._extenders.push(fn as ContextExtender);
    this._invalidate();

    return this as any;
  }

  public hook<K extends HookPhase>(
    phase: K,
    handler: HookHandlerMap<TGlobalFlags, TExt>[K],
  ): this {
    (this._hooks[phase] as HookEntry<K>[]).push({
      source: this.pluginName,
      fn: handler,
    });
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
  #scriptName = "";
  #description = "";
  #version = "";
  #examples?: MetaAsyncGetter<readonly (readonly [string, string])[]>;
  #notes?: MetaAsyncGetter<readonly string[]>;
  #themeOverrides?: Partial<ThemeStyleMap>;
  #loggerOptions?: LoggerOptions;
  #compiled?: CompiledCli;

  constructor(options: CreateCliOptions = {}) {
    super("clerc:root");

    if (options.scriptName) {
      this.#scriptName = options.scriptName;
    }
    if (options.description) {
      this.#description = options.description;
    }
    if (options.version) {
      this.#version = options.version;
    }
    if (options.examples) {
      this.#examples = options.examples;
    }
    if (options.notes) {
      this.#notes = options.notes;
    }
    if (options.theme) {
      this.#themeOverrides = options.theme;
    }
    if (options.logger) {
      this.#loggerOptions = options.logger;
    }
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
    fn: (ctx: BaseRunContext<TGlobalFlags> & TExt) => Added,
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

  #collectScope(
    scope: Plugin<any, any>,
    globalFlags: ClercFlagsDefinition,
    commands: AnyCommandDefinition[],
    groups: {
      commands: GroupDefinition[];
      flags: GroupDefinition[];
      globalFlags: GroupDefinition[];
    },
    extenders: ContextExtender[],
    hooks: HookBuckets,
  ): void {
    for (const child of scope._plugins.values()) {
      this.#collectScope(
        child,
        globalFlags,
        commands,
        groups,
        extenders,
        hooks,
      );
    }

    Object.assign(globalFlags, scope._flags);
    commands.push(...scope._commands);
    groups.commands.push(...scope._groups.commands);
    groups.flags.push(...scope._groups.flags);
    groups.globalFlags.push(...scope._groups.globalFlags);
    extenders.push(...scope._extenders);
    hooks.intercept.push(...scope._hooks.intercept);
    hooks.validate.push(...scope._hooks.validate);
    hooks.beforeRun.push(...scope._hooks.beforeRun);
    hooks.afterRun.push(...scope._hooks.afterRun);
    hooks.error.push(...scope._hooks.error);
    hooks.renderError.push(...scope._hooks.renderError);
  }

  #ensureCompiled(): CompiledCli {
    if (this.#compiled) {
      return this.#compiled;
    }

    const meta: ReadonlyCliMeta = {
      scriptName: this.#scriptName,
      description: this.#description,
      version: this.#version,
      examples: this.#examples,
      notes: this.#notes,
    };

    const mergedGlobalFlags: ClercFlagsDefinition = {};
    const collectedCommands: AnyCommandDefinition[] = [];
    const groups = {
      commands: [] as GroupDefinition[],
      flags: [] as GroupDefinition[],
      globalFlags: [] as GroupDefinition[],
    };
    const extenders: ContextExtender[] = [];
    const hooks = createHookBuckets();

    this.#collectScope(
      this,
      mergedGlobalFlags,
      collectedCommands,
      groups,
      extenders,
      hooks,
    );

    const tree = new CommandTree();
    for (const cmd of collectedCommands) {
      tree.register(cmd);
    }

    const model: ReadonlyCliModel = {
      meta,
      tree,
      globalFlags: mergedGlobalFlags,
      groups,
    };

    const globalFlags = compileFlags(mergedGlobalFlags);
    this.#compiled = {
      model,
      tree,
      extenders,
      hooks,
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

  #validateMetadata(meta: ReadonlyCliMeta): void {
    if (!meta.scriptName) {
      throw new MissingRequiredMetadataError("scriptName");
    }
    if (!meta.version) {
      throw new MissingRequiredMetadataError("version");
    }
  }

  #warnDeprecations(
    ctx: BaseRunContext<TGlobalFlags>,
    compiledFlags: CompiledFlags,
    provided: ReadonlySet<string>,
  ): void {
    if (ctx.command?.deprecated) {
      const reason =
        typeof ctx.command.deprecated === "string"
          ? `: ${ctx.command.deprecated}`
          : "";
      const pathLabel = ctx.node?.fullPath.join(" ");
      ctx.log.warn(
        `Command '${pathLabel && pathLabel.length > 0 ? pathLabel : "(root)"}' is deprecated${reason}`,
      );
    }
    for (const name of provided) {
      const entry = compiledFlags.byName.get(name);
      if (entry?.norm.deprecated) {
        const reason =
          typeof entry.norm.deprecated === "string"
            ? `: ${entry.norm.deprecated}`
            : "";
        ctx.log.warn(`Option '${entry.target}' is deprecated${reason}`);
      }
    }
  }

  async #handleError(
    caughtError: unknown,
    hooks: HookBuckets,
    ctx: BaseRunContext<TGlobalFlags> & TExt,
    throwOnUnhandled: boolean,
  ): Promise<RunResult> {
    let currentError: unknown = caughtError;

    for (const entry of hooks.error) {
      const transformed = await entry.fn(currentError, ctx);
      if (transformed !== undefined) {
        currentError = transformed;
      }
    }

    const exitCode =
      currentError instanceof ClercError ? currentError.exitCode : 1;

    for (let i = hooks.renderError.length - 1; i >= 0; i--) {
      const entry = hooks.renderError[i];
      if (await entry.fn(currentError, ctx)) {
        return {
          ok: false,
          exitCode,
          error: currentError,
          handledBy: entry.source,
        };
      }
    }

    if (throwOnUnhandled) {
      throw currentError;
    }

    return { ok: false, exitCode, error: currentError };
  }

  public async run(
    argv?: readonly string[],
    options: RunOptions = {},
  ): Promise<RunResult> {
    const terminal = options.terminal ?? createTerminal();
    const effectiveArgv = argv ?? terminal.argv;
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

    const compiledCli = this.#ensureCompiled();
    const { model, tree, extenders, hooks } = compiledCli;
    const throwOnUnhandled = options.throwOnUnhandled ?? true;

    const baseCtx: BaseRunContext<TGlobalFlags> = {
      meta: model.meta,
      model,
      terminal,
      theme,
      log,
      argv: effectiveArgv,
      args: {},
      flags: {} as any,
      unknown: {},
      ignored: [],
      doubleDash: [],
      missingRequiredFlags: [],
    };

    const ctx = baseCtx as BaseRunContext<TGlobalFlags> & TExt;
    for (const extend of extenders) {
      Object.assign(ctx, extend(baseCtx));
    }

    try {
      this.#validateMetadata(model.meta);

      // Stage 1: Resolve command tree
      const resolution = tree.resolveArgv(
        effectiveArgv,
        compiledCli.global.parser.scan,
      );
      ctx.node = resolution.node;
      ctx.command = resolution.command;
      ctx.calledAs = resolution.calledAs;

      // Stage 2: Lexical parse
      const compiledCmd = this.#compileCommand(compiledCli, ctx.command);
      const parsed = compiledCmd.parser.parse(resolution.remainingArgv);

      ctx.rawParsed = parsed;
      ctx.flags = parsed.flags as any;
      ctx.unknown = parsed.unknown;
      ctx.ignored = parsed.ignored;
      ctx.doubleDash = parsed.doubleDash;

      // Stage 3: Intercept (--version, --help, verbosity)
      for (const entry of hooks.intercept) {
        const res = await entry.fn(ctx);
        if (res?.handled) {
          return {
            ok: (res.exitCode ?? 0) === 0,
            exitCode: res.exitCode ?? 0,
            handledBy: entry.source,
          };
        }
      }

      // Stage 4: Validate command, flags, schemas, env, constraints & args
      if (!ctx.command) {
        throw createMissingCommandError(resolution);
      }

      const { flags, missingRequired, provided } = await resolveCompiledFlags(
        compiledCmd.flags,
        parsed.flags,
        parsed.provided,
        terminal.env,
      );
      ctx.flags = flags as any;
      ctx.missingRequiredFlags = missingRequired;

      this.#warnDeprecations(ctx, compiledCmd.flags, provided);

      for (const entry of hooks.validate) {
        await entry.fn(ctx);
      }

      if (missingRequired.length > 0) {
        const hints: string[] = [];
        for (const name of missingRequired) {
          const entry = compiledCmd.flags.byName.get(name);
          if (entry?.norm.env) {
            hints.push(`provide '${entry.target}' or set ${entry.norm.env}`);
          }
        }

        throw new MissingRequiredFlagError(
          missingRequired,
          hints.length > 0 ? hints : undefined,
        );
      }

      checkFlagConstraints(compiledCmd.flags, provided);

      ctx.args = compiledCmd.args
        ? await executeCompiledArgs(
            compiledCmd.args,
            parsed.parameters,
            parsed.doubleDash,
          )
        : {};

      // Stage 5: Lifecycle hooks & command execution (afterRun runs in reverse)
      for (const entry of hooks.beforeRun) {
        await entry.fn(ctx);
      }

      if (ctx.command.run) {
        await ctx.command.run(ctx as any);
      }

      for (let i = hooks.afterRun.length - 1; i >= 0; i--) {
        await hooks.afterRun[i].fn(ctx);
      }

      return { ok: true, exitCode: 0 };
    } catch (caughtError) {
      // Stage 6: Error enrichment & rendering pipeline
      return this.#handleError(caughtError, hooks, ctx, throwOnUnhandled);
    }
  }

  public async runMain(
    argv?: readonly string[],
    options?: RunOptions,
  ): Promise<RunResult> {
    const result = await this.run(argv, {
      ...options,
      throwOnUnhandled: options?.throwOnUnhandled ?? false,
    });
    if (!result.ok) {
      process.exitCode = result.exitCode;
    }

    return result;
  }
}

export const plugin = (name: string): Plugin => new Plugin(name);

export const createCli = (options?: CreateCliOptions): CliApp =>
  new CliApp(options);
