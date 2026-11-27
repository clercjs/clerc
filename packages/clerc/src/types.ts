import type { Logger, LoggerOptions } from "@clerc/logger";
import type { ThemeStyleMap } from "@clerc/theme";

import type { Command } from "./command";
import type { CommandNode, CommandTree } from "./command-tree";
import type { FlagDescriptor } from "./flags";
import type { HelpSectionRenderers } from "./help/renderer";
import type { RawInputType } from "./parser";
import type { Terminal } from "./terminal";
import type { MaybeAsyncGetter, Prettify } from "./utils";

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

export interface CompleteListOptions {
  readonly allowFiles?: boolean;
  readonly noSpace?: boolean;
  readonly keepOrder?: boolean;
}

export interface CompleteFileOptions {
  readonly extensions?: readonly string[];
}

export type CompletionSpec =
  | {
      readonly kind: "list";
      readonly items: readonly CompletionItem[];
      readonly allowFiles?: boolean;
      readonly noSpace?: boolean;
      readonly keepOrder?: boolean;
    }
  | {
      readonly kind: "file";
      readonly extensions?: readonly string[];
    }
  | {
      readonly kind: "dir";
    };

export type CompletionResult =
  readonly CompletionItem[] | CompletionSpec | false | void;

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

export type CompletionOption<
  Args extends Record<string, any> = Record<string, any>,
  Flags extends Record<string, any> = Record<string, any>,
> =
  | false
  | readonly CompletionItem[]
  | CompletionSpec
  | CompletionHandler<Args, Flags>;

export interface GroupDefinition {
  readonly key: string;
  readonly title: string;
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
  readonly globalFlags: readonly FlagDescriptor[];
  readonly groups: {
    readonly commands: readonly GroupDefinition[];
    readonly flags: readonly GroupDefinition[];
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

export interface CliContext<
  TFlags = Record<string, any>,
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
  readonly exit: (code?: number) => never;
  readonly command?: Command;
  readonly commandPath: readonly string[];
  readonly calledAs?: string;
  readonly args: Record<string, any>;
  readonly flags: Partial<TFlags> & Record<string, any>;
  readonly state: Partial<State<TState>>;
  readonly raw: RawParseContext;
}

export interface MiddlewareContext<
  TFlags = Record<string, any>,
  TState extends Record<string, any> = {},
> extends Omit<
  CliContext<TFlags, TState>,
  "flags" | "state" | "command" | "calledAs"
> {
  readonly command: Command;
  readonly calledAs: string;
  readonly flags: TFlags;
  readonly state: State<TState>;
}

export type CommandContext<
  TArgs extends Record<string, any> = Record<string, any>,
  TFlags = Record<string, any>,
  TState extends Record<string, any> = {},
> = Omit<MiddlewareContext<TFlags, TState>, "args"> & {
  readonly args: TArgs;
};

export type CommandHandler<
  TArgs extends Record<string, any> = Record<string, any>,
  TFlags = Record<string, any>,
  TState extends Record<string, any> = {},
> = (ctx: CommandContext<TArgs, TFlags, TState>) => void | Promise<void>;

export type ErrorHandler<
  TFlags = Record<string, any>,
  TState extends Record<string, any> = {},
> = (
  error: unknown,
  ctx: CliContext<TFlags, TState>,
) => boolean | void | Promise<boolean | void>;

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
