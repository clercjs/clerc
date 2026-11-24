import type { Logger, LoggerOptions } from "@clerc/logger";
import type { ThemeStyleMap } from "@clerc/theme";

import type { ContextualArgs, ExtractArgNames, InferCommandArgs } from "./args";
import type { CommandNode, CommandTree } from "./command-tree";
import type {
  ContextualFlags,
  FlagDescriptor,
  InferFlags,
  MergedFlags,
} from "./flags";
import type { HelpSectionRenderers } from "./help/renderer";
import type { RawInputType } from "./parser";
import type { RuleDescriptor, RulesFactory } from "./rules";
import type { Terminal } from "./terminal";
import type { MaybeArray, MaybeAsyncGetter, Prettify } from "./utils";

export interface CommandCustomMeta {}
export interface CustomState {}

export type CommandMeta = CommandCustomMeta & Record<string, unknown>;

export type State<TState extends Record<string, any> = {}> = Prettify<
  CustomState & TState
>;

export interface CompletionCandidate {
  readonly value: string;
  readonly description?: string;
}

export type CompletionItem = string | CompletionCandidate;

export interface CompletionDirectiveResult {
  readonly items?: readonly CompletionItem[];
  /**
   * Native shell path completion behavior:
   *
   * - `true`: allow shell file path completion
   * - `false` (default): disable shell file path fallback
   * - `"dirs"`: complete directories only
   * - `readonly string[]`: complete files matching extensions (e.g. `["json",
   *   "ts"]`)
   */
  readonly files?: boolean | "dirs" | readonly string[];
  /**
   * Suppress trailing space after accepting a completion.
   */
  readonly noSpace?: boolean;
  /**
   * Preserve candidate order instead of sorting alphabetically in the shell.
   */
  readonly keepOrder?: boolean;
}

export type CompletionResult =
  readonly CompletionItem[] | CompletionDirectiveResult | void;

export interface CompletionContext<
  Args extends Record<string, any> = Record<string, any>,
  Flags extends Record<string, any> = Record<string, any>,
> {
  readonly current: string;
  readonly words: readonly string[];
  readonly rawWords: readonly string[];
  readonly argIndex?: number;
  readonly args: Partial<Args>;
  readonly flags: Partial<Flags>;
  readonly node: CommandNode;
  readonly model: CliModel;
  readonly terminal: Terminal;
}

export type CompletionHandler<
  Args extends Record<string, any> = Record<string, any>,
  Flags extends Record<string, any> = Record<string, any>,
> = (
  ctx: CompletionContext<Args, Flags>,
) => CompletionResult | Promise<CompletionResult>;

export interface GroupDefinition {
  readonly key: string;
  readonly title: string;
}

export interface GroupsInput {
  readonly commands?: Readonly<Record<string, string>>;
  readonly flags?: Readonly<Record<string, string>>;
  readonly globalFlags?: Readonly<Record<string, string>>;
}

export type ExampleInput =
  string | readonly [command: string, description?: string];

export type MetaAsyncGetter<T> = MaybeAsyncGetter<T, CliMeta>;

export interface CliMeta {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly examples?: MetaAsyncGetter<readonly ExampleInput[]>;
  readonly notes?: MetaAsyncGetter<readonly string[]>;
}

export interface CliModel {
  readonly meta: CliMeta;
  readonly tree: CommandTree;
  readonly defaultCommand?: readonly string[];
  readonly globalFlags: readonly FlagDescriptor[];
  readonly globalRules: readonly RuleDescriptor[];
  readonly groups: {
    readonly commands: readonly GroupDefinition[];
    readonly flags: readonly GroupDefinition[];
    readonly globalFlags: readonly GroupDefinition[];
  };
}

export interface HelpHelper {
  readonly render: (commandPath?: readonly string[]) => Promise<string>;
  readonly print: (commandPath?: readonly string[]) => Promise<void>;
}

export interface HelpOptions {
  readonly command?: boolean;
  readonly header?: MetaAsyncGetter<string | undefined | void>;
  readonly footer?: MetaAsyncGetter<string | undefined | void>;
  readonly sections?: Partial<HelpSectionRenderers>;
  readonly render?: (
    model: CliModel,
    commandPath?: readonly string[],
  ) => string | Promise<string>;
}

export interface RawParseContext {
  readonly argv: readonly string[];
  readonly unknown: Record<string, RawInputType>;
  readonly doubleDash: readonly string[];
}

export interface ErrorContext<
  TGlobalFlags extends Record<string, any> = {},
  TState extends Record<string, any> = {},
> {
  readonly model: CliModel;
  readonly terminal: Terminal;
  readonly log: Logger;
  readonly help: HelpHelper;
  readonly run: (
    argv: readonly string[],
    options?: RunOptions,
  ) => Promise<RunResult>;
  readonly command?: AnyCommandDefinition;
  readonly commandPath: readonly string[];
  readonly calledAs?: string;
  readonly args: Record<string, any>;
  readonly flags: InferFlags<TGlobalFlags> & Record<string, any>;
  readonly state: Partial<State<TState>>;
  readonly raw: RawParseContext;
}

export interface RunContext<
  TGlobalFlags extends Record<string, any> = {},
  TState extends Record<string, any> = {},
> extends Omit<ErrorContext<TGlobalFlags, TState>, "state"> {
  readonly command: AnyCommandDefinition;
  readonly calledAs: string;
  readonly state: State<TState>;
}

export type CommandContext<
  Spec extends string = string,
  Args extends Partial<Record<string, any>> = {},
  Flags extends Record<string, any> = {},
  GlobalFlags extends Record<string, any> = {},
  TState extends Record<string, any> = {},
> = Omit<RunContext<GlobalFlags, TState>, "args" | "flags"> & {
  readonly args: InferCommandArgs<Spec, Args>;
  readonly flags: MergedFlags<Flags, GlobalFlags>;
};

export type CommandHandler<
  Spec extends string = string,
  Args extends Partial<Record<string, any>> = {},
  Flags extends Record<string, any> = {},
  GlobalFlags extends Record<string, any> = {},
  TState extends Record<string, any> = {},
> = (
  ctx: CommandContext<Spec, Args, Flags, GlobalFlags, TState>,
) => void | Promise<void>;

export interface CommandOptions<
  Spec extends string = string,
  Args extends Partial<Record<ExtractArgNames<Spec>, any>> = {},
  Flags extends Record<string, any> = {},
  GlobalFlags extends Record<string, any> = {},
  TState extends Record<string, any> = {},
> {
  readonly aliases?: MaybeArray<string>;
  readonly description?: string;
  readonly args?: ContextualArgs<Spec, Args>;
  readonly flags?: ContextualFlags<Flags>;
  readonly rules?: RulesFactory<
    keyof MergedFlags<NoInfer<Flags>, NoInfer<GlobalFlags>> & string,
    ExtractArgNames<Spec>,
    InferCommandArgs<Spec, NoInfer<Args>>,
    MergedFlags<NoInfer<Flags>, NoInfer<GlobalFlags>>
  >;
  readonly stopAtFirstPositional?: boolean;
  readonly standalone?: boolean;
  readonly group?: string;
  readonly hidden?: boolean;
  readonly deprecated?: boolean | string;
  readonly examples?: MetaAsyncGetter<readonly ExampleInput[]>;
  readonly notes?: MetaAsyncGetter<readonly string[]>;
  readonly complete?:
    | false
    | CompletionHandler<
        InferCommandArgs<Spec, NoInfer<Args>>,
        MergedFlags<NoInfer<Flags>, NoInfer<GlobalFlags>>
      >;
  readonly run?: CommandHandler<
    Spec,
    NoInfer<Args>,
    NoInfer<Flags>,
    NoInfer<GlobalFlags>,
    NoInfer<TState>
  >;
  readonly meta?: CommandMeta;
}

export type RootCommandOptions<
  Flags extends Record<string, any> = {},
  GlobalFlags extends Record<string, any> = {},
  TState extends Record<string, any> = {},
> = Omit<
  CommandOptions<"", {}, Flags, GlobalFlags, TState>,
  "args" | "aliases" | "group"
>;

export interface CommandDefinition<
  Spec extends string = string,
  Args extends Partial<Record<ExtractArgNames<Spec>, any>> = {},
  Flags extends Record<string, any> = {},
  GlobalFlags extends Record<string, any> = {},
  TState extends Record<string, any> = {},
> extends CommandOptions<Spec, Args, Flags, GlobalFlags, TState> {
  readonly spec: Spec;
  readonly name: string;
  readonly argTokens: readonly string[];
  /**
   * @internal
   */
  readonly builtin?: boolean;
}

export type AnyCommandDefinition = CommandDefinition<any, any, any, any, any>;

export interface MiddlewareResult<TAdded extends Record<string, any> = {}> {
  readonly "~state": TAdded;
}

export type MiddlewareNext = <Added extends Record<string, any> = {}>(
  state?: Added,
) => Promise<MiddlewareResult<Added>>;

export interface MiddlewareOptions {
  readonly enforce?: "pre" | "post";
}

export type ExtractMiddlewareState<R> =
  Awaited<R> extends MiddlewareResult<infer Added> ? Added : {};

export type Middleware<
  TGlobalFlags extends Record<string, any> = {},
  TState extends Record<string, any> = {},
  TAdded extends Record<string, any> = {},
> = (
  ctx: RunContext<TGlobalFlags, TState>,
  next: MiddlewareNext,
) =>
  | MiddlewareResult<TAdded>
  | Promise<MiddlewareResult<TAdded>>
  | void
  | Promise<void>;

export type ErrorHandler<
  TGlobalFlags extends Record<string, any> = {},
  TState extends Record<string, any> = {},
> = (
  error: unknown,
  ctx: ErrorContext<TGlobalFlags, TState>,
) => boolean | void | Promise<boolean | void>;

export interface ClercOptions {
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  readonly defaultCommand?: string;
  readonly examples?: MetaAsyncGetter<readonly ExampleInput[]>;
  readonly notes?: MetaAsyncGetter<readonly string[]>;
  readonly help?: boolean | HelpOptions;
  readonly verbosity?: boolean;
  readonly strictFlags?: boolean;
  readonly theme?: Partial<ThemeStyleMap>;
  readonly logger?: LoggerOptions;
}

export interface RunOptions {
  readonly terminal?: Terminal;
  readonly theme?: Partial<ThemeStyleMap>;
  readonly logger?: LoggerOptions;
  /**
   * When true, rethrows unhandled errors instead of rendering diagnostics to
   * stderr. Useful in tests asserting on thrown error instances.
   *
   * @default false
   */
  readonly throwOnError?: boolean;
}

export interface RunResult {
  readonly ok: boolean;
  readonly exitCode: number;
  readonly error?: unknown;
}
