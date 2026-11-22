import { parse } from "@clerc/parser";

import { CommandTree } from "./command-tree";
import {
  ClercError,
  MissingRequiredFlagError,
  MissingRequiredMetadataError,
  NoCommandError,
  UnknownCommandError,
} from "./errors";
import {
  checkFlagConstraints,
  resolveAndValidateFlags,
  toParserFlags,
} from "./flags";
import type { LoggerOptions } from "./logger";
import { createLogger } from "./logger";
import { normalizeFlagValue, parseParameters } from "./parameter";
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
import { formatFlagName } from "./utils";

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

  #initializedModel?: ReadonlyCliModel;

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
    this.#initializedModel = undefined;
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

  public buildModel(): ReadonlyCliModel {
    if (this.#initializedModel) {
      return this.#initializedModel;
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

    this.#initializedModel = model;

    return model;
  }

  #validateMetadata(meta: ReadonlyCliMeta): void {
    if (!meta.scriptName) {
      throw new MissingRequiredMetadataError("scriptName");
    }
    if (!meta.version) {
      throw new MissingRequiredMetadataError("version");
    }
  }

  public async run(
    argv?: readonly string[],
    options: RunOptions = {},
  ): Promise<RunResult> {
    const terminal = options.terminal ?? createTerminal();
    const effectiveArgv = argv ?? terminal.argv;
    const theme = createTheme(terminal.color, {
      ...this.#themeOverrides,
      ...options.theme,
    });
    const log = createLogger({
      terminal,
      theme,
      ...this.#loggerOptions,
      ...options.logger,
    });

    const model = this.buildModel();
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

      // Stage 1: Resolve command tree (delegating leading global flags to @clerc/parser)
      const tree = model.tree as CommandTree;
      const resolution = tree.resolveArgv(
        effectiveArgv,
        toParserFlags(model.globalFlags),
      );
      ctx.node = resolution.node;
      ctx.command = resolution.command;
      ctx.calledAs = resolution.calledAs;

      // Stage 2: Lexical parse (@clerc/parser)
      const mergedFlagDefs: ClercFlagsDefinition = {
        ...model.globalFlags,
        ...ctx.command?.flags,
      };
      const parsed = parse([...resolution.remainingArgv], {
        flags: toParserFlags(mergedFlagDefs),
        ignore: ctx.command?.ignore,
      });

      ctx.rawParsed = parsed;
      ctx.flags = { ...parsed.flags } as any;
      ctx.unknown = parsed.unknown;
      ctx.ignored = parsed.ignored;
      ctx.doubleDash = parsed.doubleDash;

      // Stage 3: Intercept (early short-circuit: --version, --help, verbosity)
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

      // Stage 4: Validate command existence, flags, schemas, env, constraints & parameters
      if (!ctx.command) {
        if (resolution.matchedPath.length > 0) {
          const attempted = resolution.leadingPositional
            ? [...resolution.matchedPath, resolution.leadingPositional].join(
                " ",
              )
            : resolution.matchedPath.join(" ");

          throw new UnknownCommandError(attempted, resolution.matchedPath);
        }
        if (resolution.leadingPositional) {
          throw new UnknownCommandError(resolution.leadingPositional, []);
        }

        throw new NoCommandError();
      }

      const { flags, missingRequired, provided } =
        await resolveAndValidateFlags(
          mergedFlagDefs,
          parsed.flags,
          parsed.provided,
          terminal.env,
        );
      ctx.flags = flags as any;
      ctx.missingRequiredFlags = missingRequired;

      // Emit deprecation notices for explicitly used deprecated command/flags
      if (ctx.command.deprecated) {
        const reason =
          typeof ctx.command.deprecated === "string"
            ? `: ${ctx.command.deprecated}`
            : "";
        log.warn(
          `Command '${ctx.node.fullPath.join(" ") || "(root)"}' is deprecated${reason}`,
        );
      }
      for (const name of provided) {
        const def = mergedFlagDefs[name];
        if (!def) {
          continue;
        }
        const norm = normalizeFlagValue(def);
        if (norm.deprecated) {
          const reason =
            typeof norm.deprecated === "string" ? `: ${norm.deprecated}` : "";
          log.warn(`Option '${formatFlagName(name)}' is deprecated${reason}`);
        }
      }

      // Run plugin validation hooks (e.g. strictFlags) before missing-required/parameters
      for (const plugin of model.plugins) {
        await plugin.hooks?.onValidate?.(ctx);
      }

      if (missingRequired.length > 0) {
        const hints: string[] = [];
        for (const name of missingRequired) {
          const norm = normalizeFlagValue(mergedFlagDefs[name]);
          if (norm.env) {
            hints.push(`provide '${formatFlagName(name)}' or set ${norm.env}`);
          }
        }

        throw new MissingRequiredFlagError(
          missingRequired,
          hints.length > 0 ? hints : undefined,
        );
      }

      checkFlagConstraints(mergedFlagDefs, provided);

      ctx.parameters = ctx.command.parameters
        ? await parseParameters(
            ctx.command.parameters,
            parsed.parameters,
            parsed.doubleDash,
          )
        : {};

      // Stage 5: Middleware & Command execution
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

      for (const hook of [...this.#afterRunHooks].reverse()) {
        await hook(ctx);
      }
      for (const plugin of [...model.plugins].reverse()) {
        await plugin.hooks?.afterRun?.(ctx);
      }

      return { ok: true, exitCode: 0 };
    } catch (caughtError) {
      // Stage 6: Error enrichment & rendering pipeline
      let currentError: unknown = caughtError;

      for (const plugin of model.plugins) {
        if (plugin.hooks?.onError) {
          const transformed = await plugin.hooks.onError(currentError, ctx);
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

      for (const plugin of [...model.plugins].reverse()) {
        if (plugin.hooks?.onRenderError) {
          const handled = await plugin.hooks.onRenderError(currentError, ctx);
          if (handled) {
            return {
              ok: false,
              exitCode,
              error: currentError,
              handledBy: plugin.name,
            };
          }
        }
      }

      if (throwOnUnhandled) {
        throw currentError;
      }

      return {
        ok: false,
        exitCode,
        error: currentError,
      };
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
