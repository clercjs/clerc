import { createParser } from "@clerc/parser";

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
import type { CompiledParameters } from "./parameter";
import { compileParameters, executeCompiledParameters } from "./parameter";
import { createTerminal } from "./terminal";
import type { ThemeStyleMap } from "./theme";
import { createTheme } from "./theme";
import type {
  AnyClercPlugin,
  AnyCommandDefinition,
  BaseRunContext,
  ClercFlagDefinitionValue,
  ClercFlagsDefinition,
  ClercPlugin,
  CommandDefinition,
  CommandHandler,
  CommandOptions,
  CreateOptions,
  ErrorLifecycleHook,
  GroupDefinition,
  LifecycleHook,
  ParameterDefinitionValue,
  ReadonlyCliMeta,
  ReadonlyCliModel,
  RunOptions,
  RunResult,
} from "./types";

interface CompiledCommand {
  readonly flags: CompiledFlags;
  readonly parser: ReturnType<typeof createParser>;
  readonly parameters?: CompiledParameters;
}

interface CompiledCli {
  readonly model: ReadonlyCliModel;
  readonly tree: CommandTree;
  readonly global: CompiledCommand;
  readonly commands: WeakMap<AnyCommandDefinition, CompiledCommand>;
}

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

export class Clerc<
  TGlobalFlags extends ClercFlagsDefinition = {},
  TExt extends Record<string, any> = {},
> {
  #scriptName = "";
  #description = "";
  #version = "";
  #themeOverrides?: Partial<ThemeStyleMap>;
  #loggerOptions?: LoggerOptions;
  #globalFlags: ClercFlagsDefinition = {};
  #commands: AnyCommandDefinition[] = [];
  #plugins = new Map<string, AnyClercPlugin>();
  #beforeRunHooks: LifecycleHook<any, any>[] = [];
  #afterRunHooks: LifecycleHook<any, any>[] = [];
  #onErrorHooks: ErrorLifecycleHook<any, any>[] = [];
  #groups = {
    commands: [] as GroupDefinition[],
    flags: [] as GroupDefinition[],
    globalFlags: [] as GroupDefinition[],
  };

  #compiled?: CompiledCli;

  private constructor(options: CreateOptions = {}) {
    if (options.scriptName) {
      this.#scriptName = options.scriptName;
    }
    if (options.description) {
      this.#description = options.description;
    }
    if (options.version) {
      this.#version = options.version;
    }
    if (options.theme) {
      this.#themeOverrides = options.theme;
    }
    if (options.logger) {
      this.#loggerOptions = options.logger;
    }
  }

  public static create(options?: CreateOptions): Clerc {
    return new Clerc(options);
  }

  #invalidate(): void {
    this.#compiled = undefined;
  }

  public scriptName(scriptName: string): this {
    this.#scriptName = scriptName;
    this.#invalidate();

    return this;
  }

  public description(description: string): this {
    this.#description = description;
    this.#invalidate();

    return this;
  }

  public version(version: string): this {
    this.#version = version;
    this.#invalidate();

    return this;
  }

  public theme(overrides: Partial<ThemeStyleMap>): this {
    this.#themeOverrides = { ...this.#themeOverrides, ...overrides };

    return this;
  }

  public logger(options: LoggerOptions): this {
    this.#loggerOptions = { ...this.#loggerOptions, ...options };

    return this;
  }

  public group(
    scope: "commands" | "flags" | "globalFlags",
    key: string,
    title: string,
  ): this {
    this.#groups[scope].push({ key, title });
    this.#invalidate();

    return this;
  }

  public globalFlag<
    const Name extends string,
    const Flag extends ClercFlagDefinitionValue,
  >(name: Name, flag: Flag): Clerc<TGlobalFlags & Record<Name, Flag>, TExt> {
    this.#globalFlags[name] = flag;
    this.#invalidate();

    return this;
  }

  public command<
    const Name extends string,
    const Parameters extends readonly ParameterDefinitionValue[] =
      readonly ParameterDefinitionValue[],
    const Flags extends ClercFlagsDefinition = {},
  >(
    definition: CommandDefinition<Name, Parameters, Flags, TGlobalFlags, TExt>,
  ): this;
  public command<
    const Name extends string,
    const Parameters extends readonly ParameterDefinitionValue[] =
      readonly ParameterDefinitionValue[],
    const Flags extends ClercFlagsDefinition = {},
  >(
    name: Name,
    options?: CommandOptions<Parameters, Flags, TGlobalFlags, TExt>,
    run?: CommandHandler<
      NoInfer<Parameters>,
      NoInfer<Flags>,
      TGlobalFlags,
      TExt
    >,
  ): this;
  public command(
    nameOrDef: string | AnyCommandDefinition,
    options?: CommandOptions<any, any, any, any>,
    run?: CommandHandler<any, any, any, any>,
  ): this {
    const def: AnyCommandDefinition =
      typeof nameOrDef === "string"
        ? { name: nameOrDef, ...options, ...(run ? { run } : {}) }
        : nameOrDef;
    this.#commands.push(def);
    this.#invalidate();

    return this;
  }

  public commands(defs: readonly AnyCommandDefinition[]): this {
    this.#commands.push(...defs);
    this.#invalidate();

    return this;
  }

  public use<
    PFlags extends ClercFlagsDefinition = {},
    PExt extends Record<string, any> = {},
  >(
    plugin: ClercPlugin<PFlags, PExt>,
  ): Clerc<TGlobalFlags & PFlags, TExt & PExt> {
    if (!this.#plugins.has(plugin.name)) {
      this.#plugins.set(plugin.name, plugin);
      this.#invalidate();
    }

    return this as any;
  }

  public beforeRun(hook: LifecycleHook<TGlobalFlags, TExt>): this {
    this.#beforeRunHooks.push(hook);

    return this;
  }

  public afterRun(hook: LifecycleHook<TGlobalFlags, TExt>): this {
    this.#afterRunHooks.push(hook);

    return this;
  }

  public onError(hook: ErrorLifecycleHook<TGlobalFlags, TExt>): this {
    this.#onErrorHooks.push(hook);

    return this;
  }

  #ensureCompiled(): CompiledCli {
    if (this.#compiled) {
      return this.#compiled;
    }

    const meta: ReadonlyCliMeta = {
      scriptName: this.#scriptName,
      description: this.#description,
      version: this.#version,
    };

    const plugins = [...this.#plugins.values()];
    const mergedGlobalFlags: ClercFlagsDefinition = {};
    for (const plugin of plugins) {
      if (plugin.globalFlags) {
        Object.assign(mergedGlobalFlags, plugin.globalFlags);
      }
    }
    Object.assign(mergedGlobalFlags, this.#globalFlags);

    const tree = new CommandTree();
    for (const cmd of this.#commands) {
      tree.register(cmd);
    }
    for (const plugin of plugins) {
      if (plugin.commands) {
        for (const cmd of plugin.commands(meta)) {
          tree.register(cmd);
        }
      }
    }

    const model: ReadonlyCliModel = {
      meta,
      tree,
      globalFlags: mergedGlobalFlags,
      plugins,
      groups: {
        commands: [...this.#groups.commands],
        flags: [...this.#groups.flags],
        globalFlags: [...this.#groups.globalFlags],
      },
    };

    const globalFlags = compileFlags(mergedGlobalFlags);
    this.#compiled = {
      model,
      tree,
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
      parameters: cmd.parameters
        ? compileParameters(cmd.parameters)
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
    model: ReadonlyCliModel,
    ctx: BaseRunContext<TGlobalFlags> & TExt,
    throwOnUnhandled: boolean,
  ): Promise<RunResult> {
    let currentError: unknown = caughtError;

    for (const plugin of model.plugins) {
      const onError = plugin.hooks?.onError;
      if (onError) {
        const transformed = await onError(currentError, ctx);
        if (transformed !== undefined) {
          currentError = transformed;
        }
      }
    }
    for (const hook of this.#onErrorHooks) {
      const transformed = await hook(currentError, ctx);
      if (transformed !== undefined) {
        currentError = transformed;
      }
    }

    const exitCode =
      currentError instanceof ClercError ? currentError.exitCode : 1;

    for (let i = model.plugins.length - 1; i >= 0; i--) {
      const plugin = model.plugins[i];
      const onRenderError = plugin.hooks?.onRenderError;
      if (onRenderError && (await onRenderError(currentError, ctx))) {
        return {
          ok: false,
          exitCode,
          error: currentError,
          handledBy: plugin.name,
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
    const { model, tree } = compiledCli;
    const throwOnUnhandled = options.throwOnUnhandled ?? true;

    const baseCtx: BaseRunContext<TGlobalFlags> = {
      meta: model.meta,
      model,
      terminal,
      theme,
      log,
      argv: effectiveArgv,
      parameters: {},
      flags: {} as any,
      unknown: {},
      ignored: [],
      doubleDash: [],
      missingRequiredFlags: [],
    };

    const ctx = baseCtx as BaseRunContext<TGlobalFlags> & TExt;
    for (const plugin of model.plugins) {
      if (plugin.extendContext) {
        Object.assign(ctx, plugin.extendContext(baseCtx));
      }
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
      for (const plugin of model.plugins) {
        const res = await plugin.hooks?.onIntercept?.(ctx);
        if (res?.handled) {
          return {
            ok: (res.exitCode ?? 0) === 0,
            exitCode: res.exitCode ?? 0,
            handledBy: plugin.name,
          };
        }
      }

      // Stage 4: Validate command, flags, schemas, env, constraints & parameters
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

      for (const plugin of model.plugins) {
        await plugin.hooks?.onValidate?.(ctx);
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

      ctx.parameters = compiledCmd.parameters
        ? await executeCompiledParameters(
            compiledCmd.parameters,
            parsed.parameters,
            parsed.doubleDash,
          )
        : {};

      // Stage 5: Middleware & Command execution (afterRun runs in reverse)
      for (const plugin of model.plugins) {
        await plugin.hooks?.beforeRun?.(ctx);
      }
      for (const hook of this.#beforeRunHooks) {
        await hook(ctx);
      }

      let handler = ctx.command.run;
      if (!handler && ctx.command.load) {
        const loaded = await ctx.command.load();
        handler = typeof loaded === "function" ? loaded : loaded.default;
      }
      if (handler) {
        await handler(ctx as any);
      }

      for (let i = this.#afterRunHooks.length - 1; i >= 0; i--) {
        await this.#afterRunHooks[i](ctx);
      }
      for (let i = model.plugins.length - 1; i >= 0; i--) {
        await model.plugins[i].hooks?.afterRun?.(ctx);
      }

      return { ok: true, exitCode: 0 };
    } catch (caughtError) {
      // Stage 6: Error enrichment & rendering pipeline
      return this.#handleError(caughtError, model, ctx, throwOnUnhandled);
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
