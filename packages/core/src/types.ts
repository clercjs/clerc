import type {
  FlagDefaultValue,
  IgnoreFunction,
  ObjectInputType,
  ParsedResult,
  RawInputType,
  TypeFunction,
} from "@clerc/parser";

import type { ClercError } from "./errors";
import type { Logger, LoggerOptions } from "./logger";
import type { StandardSchemaV1 } from "./schema";
import type { Terminal } from "./terminal";
import type { Theme, ThemeStyleMap } from "./theme";
import type {
  CamelCase,
  IsAny,
  MaybeArray,
  MaybeAsyncGetter,
  Prettify,
  UnionToIntersection,
} from "./utils";

export type CoreSingleType<T = any> =
  TypeFunction<T> | StandardSchemaV1<any, T>;

export type CoreTypeValue<T = any> =
  CoreSingleType<T> | readonly [CoreSingleType<T>];

export interface ClercFlagOptions<T extends CoreTypeValue = CoreTypeValue> {
  readonly type: T;
  readonly short?: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly default?: unknown;
  readonly required?: boolean;
  readonly env?: string;
  readonly negatable?: boolean;
  readonly group?: string;
  readonly hidden?: boolean;
  readonly deprecated?: boolean | string;
  readonly conflicts?: MaybeArray<string>;
  readonly implies?: MaybeArray<string>;
  readonly meta?: Record<string, unknown>;
}

export type ClercFlagDefinitionValue = ClercFlagOptions | CoreTypeValue;
export type ClercFlagsDefinition = Record<string, ClercFlagDefinitionValue>;

type InferSingleType<T> =
  T extends StandardSchemaV1<any, infer U>
    ? U
    : T extends TypeFunction<infer U>
      ? U
      : never;

type InferFlagDefault<
  T extends ClercFlagDefinitionValue,
  Fallback,
> = T extends {
  readonly default: FlagDefaultValue<infer DefaultType>;
}
  ? DefaultType
  : Fallback;

type IsTypeAny<T extends ClercFlagDefinitionValue> =
  IsAny<T> extends true
    ? true
    : T extends { readonly type: infer Type }
      ? IsAny<Type> extends true
        ? true
        : false
      : false;

type InferSingleFlag<T extends ClercFlagDefinitionValue> =
  IsTypeAny<T> extends true
    ? any
    : T extends
          | readonly [BooleanConstructor]
          | { readonly type: readonly [BooleanConstructor] }
      ? number | InferFlagDefault<T, never>
      : T extends ObjectConstructor | { readonly type: ObjectConstructor }
        ? ObjectInputType | InferFlagDefault<T, never>
        : T extends
              readonly [infer Item] | { readonly type: readonly [infer Item] }
          ? InferSingleType<Item>[] | InferFlagDefault<T, never>
          : T extends { readonly type: infer Item }
            ? | InferSingleType<Item>
              | InferFlagDefault<
                  T,
                  [InferSingleType<Item>] extends [boolean]
                    ? never
                    : T extends { readonly required: true }
                      ? never
                      : undefined
                >
            : T extends CoreSingleType
              ? | InferSingleType<T>
                | ([InferSingleType<T>] extends [boolean] ? never : undefined)
              : never;

export type InferClercFlags<T extends ClercFlagsDefinition> = Prettify<{
  [K in keyof T]: InferSingleFlag<T[K]>;
}>;

export interface ParameterOptions<T extends CoreSingleType = CoreSingleType> {
  readonly key: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly type?: T;
  readonly meta?: Record<string, unknown>;
}

export type ParameterDefinitionValue = string | ParameterOptions;

type InferStringParameter<T extends string, Type = string> = T extends
  `<${infer Name extends string}...>` | `[${infer Name extends string}...]`
  ? Record<CamelCase<Name>, Type[]>
  : T extends `<${infer Name extends string}>`
    ? Record<CamelCase<Name>, Type>
    : T extends `[${infer Name extends string}]`
      ? Record<CamelCase<Name>, Type | undefined>
      : never;

type InferParameter<T extends ParameterDefinitionValue> = T extends string
  ? InferStringParameter<T>
  : T extends { readonly key: infer K extends string; readonly type: infer PT }
    ? InferStringParameter<K, InferSingleType<PT>>
    : T extends { readonly key: infer K extends string }
      ? InferStringParameter<K>
      : never;

export type InferParameters<T extends readonly ParameterDefinitionValue[]> =
  T extends readonly (infer U extends ParameterDefinitionValue)[]
    ? [U] extends [never]
      ? {}
      : string extends U
        ? {}
        : Prettify<UnionToIntersection<InferParameter<U>>>
    : {};

type KnownKeys<T> = string extends keyof T ? never : keyof T;

export type MergedFlags<
  LocalFlags extends ClercFlagsDefinition,
  GlobalFlags extends ClercFlagsDefinition,
> = InferClercFlags<LocalFlags & Omit<GlobalFlags, KnownKeys<LocalFlags>>>;

export interface GroupDefinition {
  readonly key: string;
  readonly title: string;
}

export interface ReadonlyCliMeta {
  readonly scriptName: string;
  readonly description: string;
  readonly version: string;
}

export interface CommandNode {
  readonly name: string;
  readonly fullPath: readonly string[];
  readonly parent?: CommandNode;
  readonly children: Map<string, CommandNode>;
  readonly aliasIndex: Map<string, CommandNode>;
  command?: AnyCommandDefinition;
}

export interface ReadonlyCommandTree {
  readonly root: CommandNode;
  findNode: (path: readonly string[]) => CommandNode | undefined;
  listChildren: (node?: CommandNode) => readonly CommandNode[];
  listVisibleChildren: (node?: CommandNode) => readonly CommandNode[];
  walkCommands: () => readonly CommandNode[];
}

export interface ReadonlyCliModel {
  readonly meta: ReadonlyCliMeta;
  readonly tree: ReadonlyCommandTree;
  readonly globalFlags: Readonly<ClercFlagsDefinition>;
  readonly plugins: readonly AnyClercPlugin[];
  readonly groups: {
    readonly commands: readonly GroupDefinition[];
    readonly flags: readonly GroupDefinition[];
    readonly globalFlags: readonly GroupDefinition[];
  };
}

export interface BaseRunContext<
  TGlobalFlags extends ClercFlagsDefinition = {},
> {
  readonly meta: ReadonlyCliMeta;
  readonly model: ReadonlyCliModel;
  readonly terminal: Terminal;
  readonly theme: Theme;
  readonly log: Logger;
  readonly argv: readonly string[];
  node?: CommandNode;
  command?: AnyCommandDefinition;
  calledAs?: string;
  parameters: Record<string, any>;
  flags: InferClercFlags<TGlobalFlags> & Record<string, any>;
  unknown: Record<string, RawInputType>;
  ignored: readonly string[];
  doubleDash: readonly string[];
  rawParsed?: ParsedResult<any>;
  missingRequiredFlags: readonly string[];
}

export type CommandContext<
  Parameters extends readonly ParameterDefinitionValue[] =
    readonly ParameterDefinitionValue[],
  Flags extends ClercFlagsDefinition = {},
  GlobalFlags extends ClercFlagsDefinition = {},
  TExt extends Record<string, any> = {},
> = {
  readonly meta: ReadonlyCliMeta;
  readonly model: ReadonlyCliModel;
  readonly terminal: Terminal;
  readonly theme: Theme;
  readonly log: Logger;
  readonly argv: readonly string[];
  readonly node: CommandNode;
  readonly command: AnyCommandDefinition;
  readonly calledAs: string;
  readonly parameters: InferParameters<Parameters>;
  readonly flags: MergedFlags<Flags, GlobalFlags>;
  readonly unknown: Record<string, RawInputType>;
  readonly ignored: readonly string[];
  readonly doubleDash: readonly string[];
  readonly rawParsed: ParsedResult<any>;
} & TExt;

export type CommandHandler<
  Parameters extends readonly ParameterDefinitionValue[] =
    readonly ParameterDefinitionValue[],
  Flags extends ClercFlagsDefinition = {},
  GlobalFlags extends ClercFlagsDefinition = {},
  TExt extends Record<string, any> = {},
> = (
  ctx: CommandContext<Parameters, Flags, GlobalFlags, TExt>,
) => void | Promise<void>;

export type LazyCommandLoader<
  Parameters extends readonly ParameterDefinitionValue[] =
    readonly ParameterDefinitionValue[],
  Flags extends ClercFlagsDefinition = {},
  GlobalFlags extends ClercFlagsDefinition = {},
  TExt extends Record<string, any> = {},
> = () => Promise<
  | CommandHandler<Parameters, Flags, GlobalFlags, TExt>
  | { readonly default: CommandHandler<Parameters, Flags, GlobalFlags, TExt> }
>;

export interface CommandOptions<
  Parameters extends readonly ParameterDefinitionValue[] =
    readonly ParameterDefinitionValue[],
  Flags extends ClercFlagsDefinition = {},
  GlobalFlags extends ClercFlagsDefinition = {},
  TExt extends Record<string, any> = {},
> {
  readonly aliases?: MaybeArray<string>;
  readonly description?: string;
  readonly parameters?: Parameters;
  readonly flags?: Flags;
  readonly ignore?: IgnoreFunction;
  readonly group?: string;
  readonly hidden?: boolean;
  readonly deprecated?: boolean | string;
  readonly examples?: MaybeAsyncGetter<readonly (readonly [string, string])[]>;
  readonly notes?: MaybeAsyncGetter<readonly string[]>;
  readonly subcommands?: readonly AnyCommandDefinition[];
  readonly run?: CommandHandler<
    NoInfer<Parameters>,
    NoInfer<Flags>,
    NoInfer<GlobalFlags>,
    NoInfer<TExt>
  >;
  readonly load?: LazyCommandLoader<
    NoInfer<Parameters>,
    NoInfer<Flags>,
    NoInfer<GlobalFlags>,
    NoInfer<TExt>
  >;
  readonly meta?: Record<string, unknown>;
}

export interface CommandDefinition<
  Name extends string = string,
  Parameters extends readonly ParameterDefinitionValue[] =
    readonly ParameterDefinitionValue[],
  Flags extends ClercFlagsDefinition = {},
  GlobalFlags extends ClercFlagsDefinition = {},
  TExt extends Record<string, any> = {},
> extends CommandOptions<Parameters, Flags, GlobalFlags, TExt> {
  readonly name: Name;
}

export type AnyCommandDefinition = CommandDefinition<any, any, any, any, any>;

export type InterceptResult =
  void | undefined | { readonly handled: true; readonly exitCode?: number };

export interface PluginHooks<
  TGlobalFlags extends ClercFlagsDefinition = {},
  TExt extends Record<string, any> = {},
> {
  readonly onIntercept?: (
    ctx: BaseRunContext<TGlobalFlags> & TExt,
  ) => InterceptResult | Promise<InterceptResult>;
  readonly onValidate?: (
    ctx: BaseRunContext<TGlobalFlags> & TExt,
  ) => void | Promise<void>;
  readonly beforeRun?: (
    ctx: BaseRunContext<TGlobalFlags> & TExt,
  ) => void | Promise<void>;
  readonly afterRun?: (
    ctx: BaseRunContext<TGlobalFlags> & TExt,
  ) => void | Promise<void>;
  readonly onError?: (
    error: unknown,
    ctx: BaseRunContext<TGlobalFlags> & TExt,
  ) => unknown | Promise<unknown>;
  readonly onRenderError?: (
    error: unknown,
    ctx: BaseRunContext<TGlobalFlags> & TExt,
  ) => boolean | void | Promise<boolean | void>;
}

export interface ClercPlugin<
  TGlobalFlags extends ClercFlagsDefinition = {},
  TExt extends Record<string, any> = {},
> {
  readonly name: string;
  readonly globalFlags?: TGlobalFlags;
  readonly commands?: (
    meta: ReadonlyCliMeta,
  ) => readonly AnyCommandDefinition[];
  readonly extendContext?: (ctx: BaseRunContext<TGlobalFlags>) => TExt;
  readonly hooks?: PluginHooks<NoInfer<TGlobalFlags>, NoInfer<TExt>>;
}

export type AnyClercPlugin = ClercPlugin<any, any>;

export interface CreateOptions {
  readonly scriptName?: string;
  readonly description?: string;
  readonly version?: string;
  readonly theme?: Partial<ThemeStyleMap>;
  readonly logger?: LoggerOptions;
}

export interface RunOptions {
  readonly terminal?: Terminal;
  readonly theme?: Partial<ThemeStyleMap>;
  readonly logger?: LoggerOptions;
  /**
   * When true (default), rethrows errors if no plugin handled rendering them.
   * Set to false to always receive a structured RunResult.
   */
  readonly throwOnUnhandled?: boolean;
}

export interface RunResult {
  readonly ok: boolean;
  readonly exitCode: number;
  readonly error?: unknown;
  readonly handledBy?: string;
}

export type LifecycleHook<
  TGlobalFlags extends ClercFlagsDefinition = {},
  TExt extends Record<string, any> = {},
> = (ctx: BaseRunContext<TGlobalFlags> & TExt) => void | Promise<void>;

export type ErrorLifecycleHook<
  TGlobalFlags extends ClercFlagsDefinition = {},
  TExt extends Record<string, any> = {},
> = (
  error: unknown,
  ctx: BaseRunContext<TGlobalFlags> & TExt,
) => unknown | Promise<unknown>;

export type { ClercError };
