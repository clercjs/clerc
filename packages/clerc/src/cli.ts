import type { LoggerOptions } from "@clerc/logger";
import { createLogger } from "@clerc/logger";
import type { ThemeStyleMap } from "@clerc/theme";
import { createTheme } from "@clerc/theme";

import type { ContextualArgs, ExtractArgNames, InferCommandArgs } from "./args";
import { executeCompiledArgs, parseCommandSpec } from "./args";
import type { CheckInput } from "./check";
import { validateChecks } from "./check";
import type { Command, CommandItem, NonEmptySpec } from "./command";
import { COMMAND_ID, COMMAND_NODE, flattenCommands } from "./command";
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
import type {
  FlagsInput,
  InferFlagsInput,
  MergeFlagsTypes,
  ValidateFlagsInput,
} from "./flags";
import {
  resolveCompiledFlags,
  validateFlagConstraints,
  validateMissingRequiredFlags,
  validateParsedFlags,
  warnFlagDeprecations,
} from "./flags";
import { renderHelp } from "./help/renderer";
import type {
  InferMiddlewaresFlags,
  InferMiddlewaresState,
  Middleware,
} from "./middleware";
import type { ArgvParseResult, StopParsingOption } from "./parser";
import { createTerminal } from "./terminal";
import type {
  CliContext,
  CliMeta,
  CliModel,
  CommandHandler,
  CommandMeta,
  CompletionOption,
  ErrorHandler,
  ExampleInput,
  HelpOptions,
  MetaAsyncGetter,
  MiddlewareContext,
  RawParseContext,
  RunOptions,
  RunResult,
} from "./types";
import type { Mutable } from "./utils";

type InternalContext = Mutable<Omit<CliContext<any, any>, "state" | "raw">> & {
  state: Record<string, any>;
  raw: Mutable<RawParseContext>;
};

type EffectiveFlags<
  Use extends readonly Middleware<any, any>[],
  F extends FlagsInput,
> = MergeFlagsTypes<InferMiddlewaresFlags<Use>, InferFlagsInput<F>>;

interface CliBaseOptions<
  Use extends readonly Middleware<any, any>[],
  F extends FlagsInput,
> {
  readonly name?: string;
  readonly version?: string;
  readonly description?: string;
  readonly examples?: MetaAsyncGetter<readonly ExampleInput[]>;
  readonly notes?: MetaAsyncGetter<readonly string[]>;
  readonly help?: boolean | HelpOptions;
  readonly verbosity?: boolean;
  readonly strictFlags?: boolean;
  readonly theme?: Partial<ThemeStyleMap>;
  readonly logger?: LoggerOptions;
  readonly use?: Use;
  readonly flags?: ValidateFlagsInput<F>;
  readonly onError?: ErrorHandler<
    EffectiveFlags<Use, NoInfer<F>>,
    InferMiddlewaresState<Use>
  >;
  readonly commands?: readonly CommandItem[];
}

export interface CliOptions<
  Use extends readonly Middleware<any, any>[] = readonly [],
  F extends FlagsInput = {},
> extends CliBaseOptions<Use, F> {
  readonly check?: CheckInput<{}, EffectiveFlags<Use, NoInfer<F>>>;
  readonly stopParsing?: StopParsingOption;
  readonly deprecated?: boolean | string;
  readonly complete?: CompletionOption<{}, EffectiveFlags<Use, NoInfer<F>>>;
  readonly meta?: CommandMeta;
  readonly default?: never;
  readonly run?: CommandHandler<
    {},
    EffectiveFlags<Use, NoInfer<F>>,
    InferMiddlewaresState<Use>
  >;
}

export interface CliWithDefaultOptions<
  Use extends readonly Middleware<any, any>[] = readonly [],
  F extends FlagsInput = {},
> extends CliBaseOptions<Use, F> {
  readonly check?: CheckInput<{}, EffectiveFlags<Use, NoInfer<F>>>;
  readonly default: Command;
  readonly run?: never;
}

export interface SingleCommandCliOptions<
  Spec extends string = string,
  Args extends Partial<Record<ExtractArgNames<Spec>, any>> = {},
  Use extends readonly Middleware<any, any>[] = readonly [],
  F extends FlagsInput = {},
> extends CliBaseOptions<Use, F> {
  readonly args?: ContextualArgs<Spec, Args>;
  readonly check?: CheckInput<
    InferCommandArgs<Spec, NoInfer<Args>>,
    EffectiveFlags<Use, NoInfer<F>>
  >;
  readonly stopParsing?: StopParsingOption;
  readonly deprecated?: boolean | string;
  readonly complete?: CompletionOption<
    InferCommandArgs<Spec, NoInfer<Args>>,
    EffectiveFlags<Use, NoInfer<F>>
  >;
  readonly meta?: CommandMeta;
  readonly default?: never;
  readonly run?: CommandHandler<
    InferCommandArgs<Spec, NoInfer<Args>>,
    EffectiveFlags<Use, NoInfer<F>>,
    InferMiddlewaresState<Use>
  >;
}

export interface Cli {
  readonly run: (
    argv?: readonly string[],
    options?: RunOptions,
  ) => Promise<RunResult>;
  readonly runMain: (
    argv?: readonly string[],
    options?: RunOptions,
  ) => Promise<RunResult>;
  readonly buildModel: () => CliModel;
}

export function cli<
  const Use extends readonly Middleware<any, any>[] = readonly [],
  const F extends FlagsInput = {},
>(options: CliWithDefaultOptions<Use, F>): Cli;
export function cli<
  const Use extends readonly Middleware<any, any>[] = readonly [],
  const F extends FlagsInput = {},
>(options?: CliOptions<Use, F>): Cli;
export function cli<
  Spec extends string,
  Args extends Partial<Record<ExtractArgNames<Spec>, any>> = {},
  const Use extends readonly Middleware<any, any>[] = readonly [],
  const F extends FlagsInput = {},
>(
  spec: NonEmptySpec<Spec>,
  options: SingleCommandCliOptions<Spec, Args, Use, F>,
): Cli;
export function cli(
  specOrOptions?: string | Record<string, any>,
  maybeOptions?: Record<string, any>,
): Cli {
  const hasSpec = typeof specOrOptions === "string";
  const opts = (hasSpec ? maybeOptions : specOrOptions) ?? {};

  if (opts.name !== undefined && !String(opts.name).trim()) {
    throw new InvalidSchemaError("CLI name is required");
  }
  if (opts.run && opts.default) {
    throw new InvalidSchemaError(
      'Cannot specify both "run" and "default" on cli().',
    );
  }

  let argTokens: readonly string[] = [];
  if (hasSpec) {
    const parsedSpec = parseCommandSpec(specOrOptions);
    if (parsedSpec.name !== "") {
      throw new InvalidSchemaError(
        `cli(spec, options) signature "${specOrOptions}" can only declare positional arguments (e.g. "[files...]"); use command() inside commands: [...] for named subcommands.`,
      );
    }
    argTokens = parsedSpec.argTokens;
  }

  const meta: CliMeta = {
    name: opts.name?.trim() ?? "cli",
    description: opts.description ?? "",
    version: opts.version ?? "",
    examples: opts.examples,
    notes: opts.notes,
  };
  const helpOptions: false | HelpOptions =
    opts.help === false
      ? false
      : typeof opts.help === "object"
        ? opts.help
        : {};
  const verbosity: boolean = opts.verbosity ?? true;
  const strictFlags: boolean = opts.strictFlags ?? true;
  const themeOverrides: Partial<ThemeStyleMap> | undefined = opts.theme;
  const loggerOptions: LoggerOptions | undefined = opts.logger;

  const hasRootCommand =
    hasSpec ||
    Boolean(opts.run) ||
    opts.stopParsing !== undefined ||
    opts.deprecated !== undefined ||
    opts.complete !== undefined ||
    opts.meta !== undefined;

  const rootCommand: Command | undefined = hasRootCommand
    ? {
        [COMMAND_NODE]: true,
        [COMMAND_ID]: Symbol("cli:root"),
        spec: hasSpec ? specOrOptions.trim() : "",
        name: "",
        argTokens,
        description: meta.description || undefined,
        args: opts.args,
        stopParsing: opts.stopParsing,
        deprecated: opts.deprecated,
        complete: opts.complete,
        run: opts.run,
        meta: opts.meta,
      }
    : undefined;

  const commands = flattenCommands(opts.commands);
  let compiled: CompiledCli | undefined;

  const ensureCompiled = (): CompiledCli =>
    (compiled ??= compileCli({
      meta,
      helpOptions,
      verbosity,
      use: opts.use,
      flags: opts.flags,
      check: opts.check,
      onError: opts.onError,
      rootCommand,
      commands,
      defaultCommand: opts.default,
    }));

  function createContext(
    compiledCli: CompiledCli,
    argv: readonly string[] | undefined,
    runOpts: RunOptions,
  ): InternalContext {
    const terminal = runOpts.terminal ?? createTerminal();
    const theme = createTheme(
      terminal.color,
      themeOverrides || runOpts.theme
        ? { ...themeOverrides, ...runOpts.theme }
        : undefined,
    );
    const log = createLogger({
      terminal,
      theme,
      ...loggerOptions,
      ...runOpts.logger,
    });
    const helpOpts = helpOptions === false ? undefined : helpOptions;
    const render = async (commandPath?: readonly string[]): Promise<string> =>
      helpOpts?.render
        ? helpOpts.render(compiledCli.model, commandPath)
        : renderHelp(compiledCli.model, {
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

    return {
      model: compiledCli.model,
      terminal,
      log,
      help: {
        render,
        print: async (commandPath) => {
          terminal.stdout(await render(commandPath));
        },
      },
      run: (nextArgv, nextOptions) => run(nextArgv, nextOptions),
      exit(code = 1): never {
        throw new ExitSignal(code);
      },
      commandPath: [],
      args: {},
      flags: {},
      state: {},
      raw: { argv: argv ?? terminal.argv, unknown: {}, doubleDash: [] },
    };
  }

  async function run(
    argv?: readonly string[],
    runOpts: RunOptions = {},
  ): Promise<RunResult> {
    const compiledCli = ensureCompiled();
    const ctx = createContext(compiledCli, argv, runOpts);
    const getRuntime = (node: CommandNode): CompiledNodeRuntime =>
      compiledCli.runtimes.get(node)!;
    let runtime = compiledCli.rootRuntime;

    try {
      let match = compiledCli.tree.resolveArgv(ctx.raw.argv, (node) => {
        const scanTarget =
          !node.command?.run && node.defaultChild ? node.defaultChild : node;

        return getRuntime(scanTarget).parser.scan;
      });

      const matchedRuntime = getRuntime(match.node);
      let preParsed: ArgvParseResult | undefined;
      function isBuiltinRequest(): boolean {
        if (match.kind !== "empty" && match.kind !== "namespace") {
          return false;
        }
        preParsed ??= matchedRuntime.parser.parse(match.remainingArgv);

        return (
          (matchedRuntime.hasBuiltinVersion &&
            preParsed.flags.version === true) ||
          (matchedRuntime.hasBuiltinHelp && preParsed.flags.help === true)
        );
      }

      const defaultChild = match.node.defaultChild;
      if (
        defaultChild?.command &&
        (((match.kind === "empty" || match.kind === "namespace") &&
          !isBuiltinRequest()) ||
          (match.kind === "unknown" && matchedRuntime.defaultAcceptsArgs))
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

      runtime = getRuntime(match.node);
      const parsed =
        runtime === matchedRuntime && preParsed
          ? preParsed
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

      validateParsedFlags(
        runtime.userFlags,
        runtime.knownFlagNames,
        parsed,
        strictFlags,
      );

      if (match.kind !== "matched") {
        if (helpOptions !== false) {
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

      const { flags, missingRequired, provided } = await resolveCompiledFlags(
        runtime.userFlags,
        parsed.flags,
        parsed.provided,
        ctx.terminal.env,
      );
      ctx.flags = flags;
      validateMissingRequiredFlags(runtime.userFlags, missingRequired);

      const { args: resolvedArgs, provided: providedArgs } =
        await executeCompiledArgs(
          runtime.args!,
          parsed.positionals,
          parsed.doubleDash,
          ctx.terminal.env,
        );
      ctx.args = resolvedArgs;

      if (runtime.constraints.length > 0) {
        validateFlagConstraints(
          runtime.constraints,
          provided,
          runtime.userFlags.byName,
        );
      }
      if (runtime.checks.length > 0) {
        await validateChecks(runtime.checks, {
          args: ctx.args,
          flags: ctx.flags,
          provided: { flags: provided, args: providedArgs },
          terminal: ctx.terminal,
        });
      }

      const matchedCommand = match.command;
      const mwCtx = ctx as unknown as MiddlewareContext<any, any>;
      async function runCore(): Promise<void> {
        if (matchedCommand.deprecated) {
          const reason =
            typeof matchedCommand.deprecated === "string"
              ? `: ${matchedCommand.deprecated}`
              : "";
          ctx.log.warn(
            `Command '${ctx.commandPath.join(" ") || ctx.model.meta.name}' is deprecated${reason}`,
          );
        }
        warnFlagDeprecations(runtime.userFlags, provided, ctx.log.warn);
        if (matchedCommand.run) {
          await matchedCommand.run(mwCtx);
        }
      }

      async function dispatch(index: number): Promise<void> {
        const mw = runtime.middlewares[index];
        if (!mw) {
          return runCore();
        }
        if (mw.setup) {
          const added = await mw.setup(mwCtx);
          if (added && typeof added === "object") {
            Object.assign(ctx.state, added);
          }
        }
        if (mw.run) {
          await mw.run(mwCtx, () => dispatch(index + 1));
        } else {
          await dispatch(index + 1);
        }
      }
      await dispatch(0);

      return { ok: true, exitCode: 0 };
    } catch (error) {
      if (error instanceof ExitSignal) {
        return { ok: error.exitCode === 0, exitCode: error.exitCode };
      }

      try {
        enrichCommandError(error, compiledCli.model, ctx.commandPath);
        const exitCode = error instanceof ClercError ? error.exitCode : 1;
        const cliCtx = ctx as unknown as CliContext<any, any>;

        for (let i = runtime.errorHandlers.length - 1; i >= 0; i--) {
          if (await runtime.errorHandlers[i](error, cliCtx)) {
            return { ok: false, exitCode, error };
          }
        }
        if (runOpts.throwOnError) {
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
            showHelpHint: helpOptions !== false,
          }),
        );

        return { ok: false, exitCode, error };
      } catch (handlerError) {
        if (handlerError instanceof ExitSignal) {
          return {
            ok: handlerError.exitCode === 0,
            exitCode: handlerError.exitCode,
          };
        }

        throw handlerError;
      }
    }
  }

  return {
    run,
    async runMain(argv, runOpts) {
      const result = await run(argv, runOpts);
      if (!result.ok) {
        process.exitCode = result.exitCode;
      }

      return result;
    },
    buildModel: () => ensureCompiled().model,
  };
}
