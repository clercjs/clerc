import type { LoggerOptions } from "@clerc/logger";
import { createLogger } from "@clerc/logger";
import type { ThemeStyleMap } from "@clerc/theme";
import { createTheme } from "@clerc/theme";

import { executeCompiledArgs } from "./args";
import type { CompiledCli } from "./compile";
import { compileCli, formatCliVersion } from "./compile";
import {
  ClercError,
  InvalidSchemaError,
  NoCommandError,
  UnknownCommandError,
  enrichCommandError,
  formatDiagnostic,
  formatJsonError,
} from "./errors";
import type { ContextualFlags, FlagsDefinition } from "./flags";
import {
  resolveCompiledFlags,
  validateMissingRequiredFlags,
  validateParsedFlags,
  warnFlagDeprecations,
} from "./flags";
import { renderHelp } from "./help/renderer";
import type { ArgvParseResult } from "./parser";
import type { AnyMiddlewareFn } from "./plugin";
import { Plugin, getPluginState } from "./plugin";
import { validateCustomRules, validateDeclarativeRules } from "./rules";
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

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
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
      throw new InvalidSchemaError("CLI name is required");
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
    return (this.#compiled ??= compileCli({
      root: this,
      meta: this.#meta,
      defaultCommand: this.#defaultCommand,
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
    const isStandalone = Boolean(matchedCommand.standalone);

    validateMissingRequiredFlags(
      runtime.userFlags,
      isStandalone ? [] : missingRequired,
    );

    const { args: resolvedArgs, provided: providedArgs } =
      await executeCompiledArgs(
        runtime.args!,
        parsed.positionals,
        parsed.doubleDash,
        ctx.terminal.env,
      );
    ctx.args = resolvedArgs;

    const activeDeclarativeRules = isStandalone
      ? runtime.rules.declarative
      : [...compiledCli.globalRules.declarative, ...runtime.rules.declarative];
    if (activeDeclarativeRules.length > 0) {
      validateDeclarativeRules(
        activeDeclarativeRules,
        provided,
        providedArgs,
        runtime.userFlags.byName,
        runtime.argsByName,
      );
    }

    const activeCustomRules = isStandalone
      ? runtime.rules.custom
      : [...compiledCli.globalRules.custom, ...runtime.rules.custom];
    if (activeCustomRules.length > 0) {
      await validateCustomRules(activeCustomRules, {
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
    enrichCommandError(error, compiledCli.model, ctx.commandPath);

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

export const clerc = (options: ClercOptions): Clerc => new Clerc(options);
