import type { LoggerOptions } from "@clerc/logger";
import { createLogger } from "@clerc/logger";
import type { ThemeStyleMap } from "@clerc/theme";
import { createTheme } from "@clerc/theme";

import { executeCompiledArgs } from "./args";
import type { CommandNode } from "./command-tree";
import type { CompiledCli, CompiledNodeRuntime } from "./compile";
import { compileCli, formatCliVersion } from "./compile";
import {
  ClercError,
  ExitSignal,
  InvalidSchemaError,
  NoCommandError,
  UnknownCommandError,
  enrichCommandError,
  formatDiagnostic,
} from "./errors";
import type { ContextualFlags, FlagsDefinition, OverrideFlags } from "./flags";
import {
  resolveCompiledFlags,
  validateMissingRequiredFlags,
  validateParsedFlags,
  warnFlagDeprecations,
} from "./flags";
import { renderHelp } from "./help/renderer";
import type { ArgvParseResult } from "./parser";
import { Plugin } from "./plugin";
import { validateCustomRules, validateDeclarativeRules } from "./rules";
import type { AnyMiddlewareFn } from "./scope";
import { getScopeState } from "./scope";
import { createTerminal } from "./terminal";
import type {
  ClercOptions,
  CliMeta,
  CliModel,
  ErrorContext,
  ExtractMiddlewareState,
  HelpOptions,
  MiddlewareNext,
  MiddlewareOptions,
  RawParseContext,
  RunContext,
  RunOptions,
  RunResult,
} from "./types";
import type { Mutable } from "./utils";

type InternalContext<
  TGlobalFlags extends Record<string, any>,
  TState extends Record<string, any>,
> = Mutable<Omit<ErrorContext<TGlobalFlags, TState>, "state" | "raw">> & {
  state: Record<string, any>;
  raw: Mutable<RawParseContext>;
};

export class Clerc<
  TGlobalFlags extends Record<string, any> = {},
  TState extends Record<string, any> = {},
> extends Plugin<TGlobalFlags, TState> {
  readonly #meta: CliMeta;
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
      throw new InvalidSchemaError("CLI name is required");
    }
    this.#meta = {
      name,
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
    this.#verbosity = options.verbosity ?? true;
    this.#strictFlags = options.strictFlags ?? true;
    this.#themeOverrides = options.theme;
    this.#loggerOptions = options.logger;
    getScopeState(this).onInvalidate = () => {
      this.#compiled = undefined;
    };
  }

  public override flags<const Flags extends FlagsDefinition>(
    definitions: ContextualFlags<Flags>,
  ): Clerc<OverrideFlags<TGlobalFlags, Flags>, TState> {
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
  ): Clerc<OverrideFlags<TGlobalFlags, PFlags>, TState & PState> {
    super.use(other);

    return this as any;
  }

  #ensureCompiled(): CompiledCli {
    return (this.#compiled ??= compileCli({
      root: this,
      meta: this.#meta,
      helpOptions: this.#helpOptions,
      verbosity: this.#verbosity,
    }));
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
      exit(code = 1): never {
        throw new ExitSignal(code);
      },
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
    setActiveRuntime: (runtime: CompiledNodeRuntime) => void,
  ): Promise<RunResult> {
    // 1. Resolve command match (matched | namespace | empty | unknown)
    const getRuntime = (node: CommandNode): CompiledNodeRuntime =>
      compiledCli.runtimes.get(node)!;

    let match = compiledCli.tree.resolveArgv(
      ctx.raw.argv,
      (node) => getRuntime(node).parser.scan,
    );

    const matchedNodeRuntime = getRuntime(match.node);
    let cachedPreParsed: ArgvParseResult | undefined;
    function isBuiltinRequest(): boolean {
      if (match.kind !== "empty" && match.kind !== "namespace") {
        return false;
      }
      cachedPreParsed ??= matchedNodeRuntime.parser.parse(match.remainingArgv);

      return (
        (matchedNodeRuntime.hasBuiltinVersion &&
          cachedPreParsed.flags.version === true) ||
        (matchedNodeRuntime.hasBuiltinHelp &&
          cachedPreParsed.flags.help === true)
      );
    }

    const defaultChild = match.node.defaultChild;
    if (
      defaultChild?.command &&
      (((match.kind === "empty" || match.kind === "namespace") &&
        !isBuiltinRequest()) ||
        (match.kind === "unknown" && matchedNodeRuntime.defaultAcceptsArgs))
    ) {
      match = {
        kind: "matched",
        node: defaultChild,
        command: defaultChild.command,
        calledAs: defaultChild.fullPath.join(" "),
        remainingArgv: match.remainingArgv,
      };
    }

    ctx.commandPath = match.node.fullPath;
    if (match.kind === "matched") {
      ctx.command = match.command;
      ctx.calledAs = match.calledAs;
    }

    // 2. Parse raw argv into flags & positionals
    const runtime = getRuntime(match.node);
    setActiveRuntime(runtime);
    const parsed =
      runtime === matchedNodeRuntime && cachedPreParsed
        ? cachedPreParsed
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
    validateMissingRequiredFlags(runtime.userFlags, missingRequired);

    const { args: resolvedArgs, provided: providedArgs } =
      await executeCompiledArgs(
        runtime.args!,
        parsed.positionals,
        parsed.doubleDash,
        ctx.terminal.env,
      );
    ctx.args = resolvedArgs;

    if (runtime.rules.declarative.length > 0) {
      validateDeclarativeRules(
        runtime.rules.declarative,
        provided,
        providedArgs,
        runtime.userFlags.byName,
        runtime.argsByName,
      );
    }

    if (runtime.rules.custom.length > 0) {
      await validateCustomRules(runtime.rules.custom, {
        args: ctx.args,
        flags: ctx.flags,
        provided: { flags: provided, args: providedArgs },
        terminal: ctx.terminal,
      });
    }

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
    if (runtime.middlewares.length === 0) {
      await runCore();
    } else {
      async function dispatch(
        index: number,
        added?: Record<string, any>,
      ): Promise<any> {
        if (added) {
          Object.assign(ctx.state, added);
        }
        const mw = runtime.middlewares[index];
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
    activeRuntime: CompiledNodeRuntime,
    ctx: InternalContext<TGlobalFlags, TState>,
    throwOnError: boolean,
  ): Promise<RunResult> {
    enrichCommandError(error, compiledCli.model, ctx.commandPath);

    const exitCode = error instanceof ClercError ? error.exitCode : 1;
    const errCtx = ctx as unknown as ErrorContext<TGlobalFlags, TState>;

    for (let i = activeRuntime.errorHandlers.length - 1; i >= 0; i--) {
      if (await activeRuntime.errorHandlers[i](error, errCtx)) {
        return { ok: false, exitCode, error };
      }
    }

    if (throwOnError) {
      throw error;
    }

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

    return { ok: false, exitCode, error };
  }

  public async run(
    argv?: readonly string[],
    options: RunOptions = {},
  ): Promise<RunResult> {
    const compiledCli = this.#ensureCompiled();
    const ctx = this.#createContext(compiledCli, argv, options);
    let activeRuntime = compiledCli.rootRuntime;

    const toExitResult = (err: ExitSignal): RunResult => ({
      ok: err.exitCode === 0,
      exitCode: err.exitCode,
    });

    try {
      return await this.#execute(compiledCli, ctx, (rt) => {
        activeRuntime = rt;
      });
    } catch (caughtError) {
      if (caughtError instanceof ExitSignal) {
        return toExitResult(caughtError);
      }

      try {
        return await this.#handleError(
          caughtError,
          compiledCli,
          activeRuntime,
          ctx,
          options.throwOnError ?? false,
        );
      } catch (handlerError) {
        if (handlerError instanceof ExitSignal) {
          return toExitResult(handlerError);
        }

        throw handlerError;
      }
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

export const clerc = (options: ClercOptions): Clerc => new Clerc(options);
