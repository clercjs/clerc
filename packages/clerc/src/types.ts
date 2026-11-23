import type { Logger, LoggerOptions } from "@clerc/logger";
import type { Theme, ThemeStyleMap } from "@clerc/theme";

import type { ClercError } from "./errors";
import type { HelpSectionRenderers } from "./help/renderer";
import type { RawInputType } from "./parser";
import type { FlagKind, StandardSchemaV1 } from "./schema";
import type { Terminal } from "./terminal";
import type {
  CamelCase,
  IsAny,
  MaybeArray,
  MaybeAsyncGetter,
  Prettify,
} from "./utils";

export interface DefaultValueFunction<T> {
  (): T;
  display?: string;
}

export type DefaultValue<T = unknown> = T | DefaultValueFunction<T>;

export interface TypeFunction<T = unknown> {
  (value: string): T;
  display?: string;
}

export type SingleType<T = any> = TypeFunction<T> | StandardSchemaV1<any, T>;

export type TypeValue<T = any> = SingleType<T> | readonly [SingleType<T>];

export interface CommandCustomMeta {}
export interface FlagCustomMeta {}
export interface ArgCustomMeta {}
export interface CustomState {}

export type CommandMeta = CommandCustomMeta & Record<string, unknown>;
export type FlagMeta = FlagCustomMeta & Record<string, unknown>;
export type ArgMeta = ArgCustomMeta & Record<string, unknown>;

export type State<TState extends Record<string, any> = {}> = Prettify<
  CustomState & TState
>;

export interface FlagOptions<T extends TypeValue = TypeValue> {
  readonly type: T;
  readonly short?: string;
  readonly aliases?: MaybeArray<string>;
  readonly description?: string;
  readonly placeholder?: string;
  readonly default?: DefaultValue;
  readonly implicitValue?: DefaultValue;
  readonly delimiter?: string;
  readonly required?: boolean;
  readonly env?: string;
  readonly negatable?: boolean;
  readonly group?: string;
  readonly hidden?: boolean;
  readonly deprecated?: boolean | string;
  readonly conflicts?: MaybeArray<string>;
  readonly implies?: MaybeArray<string>;
  readonly meta?: FlagMeta;
}

export type FlagDefinitionValue = FlagOptions | TypeValue;
export type FlagsDefinition = Record<string, FlagDefinitionValue>;

type StrictOptions<T, Allowed> = T extends object
  ? Allowed & Readonly<Partial<Record<Exclude<keyof T, keyof Allowed>, never>>>
  : Allowed;

type ContextualFlagValue<V> = [V] extends [never]
  ? FlagOptions
  : V extends SingleType | readonly [SingleType]
    ? V
    : StrictOptions<V, FlagOptions>;

export type ContextualFlags<Flags extends Record<string, any>> = {
  readonly [K in keyof Flags]: ContextualFlagValue<Flags[K]>;
};

export interface FlagDescriptor {
  readonly name: string;
  readonly target: string;
  readonly short?: string;
  readonly aliases: readonly string[];
  readonly kind: FlagKind;
  readonly display: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly default?: unknown;
  readonly implicitValue?: unknown;
  readonly delimiter?: string;
  readonly required: boolean;
  readonly env?: string;
  readonly negatable: boolean;
  readonly group?: string;
  readonly hidden: boolean;
  readonly deprecated?: boolean | string;
  readonly conflicts: readonly string[];
  readonly implies: readonly string[];
  readonly meta?: FlagMeta;
  readonly toJsonSchema: () => Record<string, unknown>;
}

export interface ArgDescriptor {
  readonly name: string;
  readonly rawName: string;
  readonly token: string;
  readonly isRequired: boolean;
  readonly isVariadic: boolean;
  readonly afterDoubleDash: boolean;
  readonly display?: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly default?: unknown;
  readonly env?: string;
  readonly meta?: ArgMeta;
  readonly toJsonSchema: () => Record<string, unknown>;
}

type InferStandardSchemaOutput<T extends StandardSchemaV1<any, any>> =
  T["~standard"] extends {
    readonly types?: { readonly output: infer Output } | undefined;
  }
    ? IsAny<Output> extends true
      ? any
      : unknown extends Output
        ? T extends StandardSchemaV1<any, infer U>
          ? U
          : Output
        : Output
    : T extends StandardSchemaV1<any, infer U>
      ? U
      : never;

type InferSingleType<T> =
  T extends StandardSchemaV1<any, any>
    ? InferStandardSchemaOutput<T>
    : T extends TypeFunction<infer U>
      ? U
      : never;

type WidenReadonlyArray<V> = V extends readonly (infer U)[] ? U[] : V;

type UnwrapDefault<D> = D extends () => infer R
  ? WidenReadonlyArray<R>
  : WidenReadonlyArray<D>;

type MergeArrayDefault<Elem, Default> = [Default] extends [never]
  ? Elem[]
  : Default extends (infer U)[]
    ? [U] extends [Elem]
      ? Elem[]
      : Elem[] | Default
    : Elem[] | Default;

type InferFlagDefault<T extends FlagDefinitionValue, Fallback> = T extends {
  readonly default: infer D;
}
  ? [D] extends [undefined]
    ? Fallback
    : UnwrapDefault<D>
  : Fallback;

type InferFlagImplicitValue<T extends FlagDefinitionValue> = T extends {
  readonly implicitValue: infer D;
}
  ? [D] extends [undefined]
    ? never
    : UnwrapDefault<D>
  : never;

type IsTypeAny<T extends FlagDefinitionValue> =
  IsAny<T> extends true
    ? true
    : T extends { readonly type: infer Type }
      ? IsAny<Type> extends true
        ? true
        : false
      : false;

type InferSingleFlag<T extends FlagDefinitionValue> =
  IsTypeAny<T> extends true
    ? any
    : T extends
          | readonly [BooleanConstructor]
          | { readonly type: readonly [BooleanConstructor] }
      ? number | InferFlagDefault<T, never>
      : T extends
            readonly [infer Item] | { readonly type: readonly [infer Item] }
        ? MergeArrayDefault<InferSingleType<Item>, InferFlagDefault<T, never>>
        : T extends { readonly type: infer Item }
          ? | InferSingleType<Item>
            | InferFlagImplicitValue<T>
            | InferFlagDefault<
                T,
                [InferSingleType<Item>] extends [boolean]
                  ? never
                  : T extends { readonly required: true }
                    ? never
                    : undefined
              >
          : T extends SingleType
            ? | InferSingleType<T>
              | ([InferSingleType<T>] extends [boolean] ? never : undefined)
            : never;

export type InferFlags<T extends Record<string, any>> = Prettify<{
  [K in keyof T]: T[K] extends FlagDefinitionValue
    ? InferSingleFlag<T[K]>
    : never;
}>;

export interface ArgOptions<T extends SingleType = SingleType> {
  readonly type?: T;
  readonly description?: string;
  readonly placeholder?: string;
  readonly default?: DefaultValue;
  readonly env?: string;
  readonly meta?: ArgMeta;
}

export type ArgDefinitionValue = SingleType | ArgOptions;

type ContextualArgValue<V> = [V] extends [never]
  ? ArgOptions
  : V extends SingleType
    ? V
    : StrictOptions<V, ArgOptions>;

export type ContextualArgs<
  Spec extends string,
  Args extends Partial<Record<ExtractArgNames<Spec>, any>>,
> = {
  readonly [K in keyof Args]: K extends ExtractArgNames<Spec>
    ? ContextualArgValue<Args[K]>
    : never;
} & Partial<Record<Exclude<ExtractArgNames<Spec>, keyof Args>, ArgOptions>>;

type TrimWhitespace<S extends string> = S extends
  | ` ${infer R}`
  | `${infer R} `
  | `\t${infer R}`
  | `${infer R}\t`
  | `\n${infer R}`
  | `${infer R}\n`
  ? TrimWhitespace<R>
  : S;

export type NonEmptySpec<S extends string> = string extends S
  ? S
  : TrimWhitespace<S> extends ""
    ? never
    : S;

type StripVariadic<S extends string> = S extends `${infer Name}...` ? Name : S;

type ExtractSingleArgName<Token extends string> = Token extends
  `<${infer Raw}>` | `[${infer Raw}]`
  ? CamelCase<StripVariadic<Raw>>
  : never;

export type ExtractArgNames<S extends string> =
  S extends `${infer Head} ${infer Rest}`
    ? ExtractSingleArgName<Head> | ExtractArgNames<Rest>
    : ExtractSingleArgName<S>;

type ResolveArgType<
  Name extends string,
  Args extends Partial<Record<string, any>>,
> = Name extends keyof Args
  ? NonNullable<Args[Name]> extends { readonly type: infer T }
    ? [T] extends [undefined]
      ? string
      : InferSingleType<T>
    : NonNullable<Args[Name]> extends SingleType
      ? InferSingleType<NonNullable<Args[Name]>>
      : string
  : string;

type InferArgDefault<
  Name extends string,
  Args extends Partial<Record<string, any>>,
  Fallback,
> = Name extends keyof Args
  ? NonNullable<Args[Name]> extends { readonly default: infer D }
    ? [D] extends [undefined]
      ? Fallback
      : UnwrapDefault<D>
    : Fallback
  : Fallback;

type InferTokenArg<
  Token extends string,
  Args extends Partial<Record<string, any>>,
> = Token extends `<${infer Name}...>`
  ? Record<CamelCase<Name>, ResolveArgType<CamelCase<Name>, Args>[]>
  : Token extends `[${infer Name}...]`
    ? Record<
        CamelCase<Name>,
        MergeArrayDefault<
          ResolveArgType<CamelCase<Name>, Args>,
          InferArgDefault<CamelCase<Name>, Args, never>
        >
      >
    : Token extends `<${infer Name}>`
      ? Record<CamelCase<Name>, ResolveArgType<CamelCase<Name>, Args>>
      : Token extends `[${infer Name}]`
        ? Record<
            CamelCase<Name>,
            | ResolveArgType<CamelCase<Name>, Args>
            | InferArgDefault<CamelCase<Name>, Args, undefined>
          >
        : {};

type InferSpecArgsAcc<
  S extends string,
  Args extends Partial<Record<string, any>>,
> = S extends `${infer Head} ${infer Rest}`
  ? InferTokenArg<Head, Args> & InferSpecArgsAcc<Rest, Args>
  : InferTokenArg<S, Args>;

export type InferCommandArgs<
  Spec extends string,
  Args extends Partial<Record<string, any>> = {},
> = string extends Spec
  ? Record<string, any>
  : Prettify<InferSpecArgsAcc<Spec, Args>>;

type KnownKeys<T> = string extends keyof T ? never : keyof T;

export type MergedFlags<
  LocalFlags extends Record<string, any>,
  GlobalFlags extends Record<string, any>,
> = InferFlags<LocalFlags & Omit<GlobalFlags, KnownKeys<LocalFlags>>>;

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

export interface CommandNode {
  readonly name: string;
  readonly fullPath: readonly string[];
  readonly parent?: CommandNode;
  readonly children: ReadonlyMap<string, CommandNode>;
  readonly aliasIndex: ReadonlyMap<string, CommandNode>;
  readonly aliases: readonly string[];
  readonly command?: AnyCommandDefinition;
  readonly args: readonly ArgDescriptor[];
  readonly localFlags: readonly FlagDescriptor[];
  readonly builtinFlags: readonly FlagDescriptor[];
}

export interface CommandTree {
  readonly root: CommandNode;
  findNode: (path: readonly string[]) => CommandNode | undefined;
  listChildren: (node?: CommandNode) => readonly CommandNode[];
  listVisibleChildren: (node?: CommandNode) => readonly CommandNode[];
  walkCommands: () => readonly (CommandNode & {
    readonly command: AnyCommandDefinition;
  })[];
}

export interface CliModel {
  readonly meta: CliMeta;
  readonly tree: CommandTree;
  readonly defaultCommand?: readonly string[];
  readonly globalFlags: readonly FlagDescriptor[];
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

export interface ErrorContext<
  TGlobalFlags extends Record<string, any> = {},
  TState extends Record<string, any> = {},
> {
  readonly meta: CliMeta;
  readonly model: CliModel;
  readonly terminal: Terminal;
  readonly theme: Theme;
  readonly log: Logger;
  readonly help: HelpHelper;
  readonly run: (
    argv: readonly string[],
    options?: RunOptions,
  ) => Promise<RunResult>;
  readonly argv: readonly string[];
  readonly command?: AnyCommandDefinition;
  readonly commandPath: readonly string[];
  readonly calledAs?: string;
  readonly args: Record<string, any>;
  readonly flags: InferFlags<TGlobalFlags> & Record<string, any>;
  readonly state: Partial<State<TState>>;
  readonly unknown: Record<string, RawInputType>;
  readonly doubleDash: readonly string[];
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
  readonly stopAtFirstPositional?: boolean;
  readonly group?: string;
  readonly hidden?: boolean;
  readonly deprecated?: boolean | string;
  readonly examples?: MetaAsyncGetter<readonly ExampleInput[]>;
  readonly notes?: MetaAsyncGetter<readonly string[]>;
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

export interface MiddlewareNext {
  (): Promise<MiddlewareResult>;
  <Added extends Record<string, any>>(
    state: Added,
  ): Promise<MiddlewareResult<Added>>;
}

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

export type { ClercError };
