import type {
  ArgDefinitionValue,
  ContextualArgs,
  ExtractArgNames,
  InferCommandArgs,
} from "./args";
import { parseCommandSpec } from "./args";
import type { CheckInput } from "./check";
import { InvalidSchemaError } from "./errors";
import type {
  FlagsGroupNode,
  FlagsInput,
  InferFlagsInput,
  MergeFlagsTypes,
  ValidateFlagsInput,
} from "./flags";
import { createFlagsGroup } from "./flags";
import type {
  InferMiddlewaresFlags,
  InferMiddlewaresState,
  Middleware,
} from "./middleware";
import type { StopParsingOption } from "./parser";
import type {
  CommandHandler,
  CommandMeta,
  CompletionOption,
  ErrorHandler,
  ExampleInput,
  MetaAsyncGetter,
} from "./types";
import type { MaybeArray } from "./utils";
import { toArray } from "./utils";

export const COMMAND_NODE: unique symbol = Symbol.for("clerc.command");
export const COMMAND_ID: unique symbol = Symbol.for("clerc.commandId");

export type NonEmptySpec<S extends string> = S extends "" ? never : S;

export type CommandItem = Command | readonly CommandItem[];

export interface Command {
  readonly [COMMAND_NODE]: true;
  readonly [COMMAND_ID]: symbol;
  readonly spec: string;
  readonly name: string;
  readonly argTokens: readonly string[];
  readonly aliases?: MaybeArray<string>;
  readonly description?: string;
  readonly args?: Readonly<Record<string, ArgDefinitionValue>>;
  readonly flags?: FlagsInput;
  readonly use?: readonly Middleware<any, any>[];
  readonly check?: CheckInput<any, any>;
  readonly onError?: ErrorHandler<any, any>;
  readonly stopParsing?: StopParsingOption;
  readonly group?: string;
  readonly hidden?: boolean;
  readonly deprecated?: boolean | string;
  readonly examples?: MetaAsyncGetter<readonly ExampleInput[]>;
  readonly notes?: MetaAsyncGetter<readonly string[]>;
  readonly complete?: CompletionOption<any, any>;
  readonly commands?: readonly Command[];
  readonly default?: Command;
  readonly run?: CommandHandler<any, any, any>;
  readonly meta?: CommandMeta;
  /**
   * @internal
   */
  readonly builtin?: boolean;
}

type EffectiveFlags<
  Use extends readonly Middleware<any, any>[],
  F extends FlagsInput,
> = MergeFlagsTypes<InferMiddlewaresFlags<Use>, InferFlagsInput<F>>;

interface CommandSharedOptions<
  Use extends readonly Middleware<any, any>[],
  F extends FlagsInput,
> {
  readonly aliases?: MaybeArray<string>;
  readonly description?: string;
  readonly flags?: ValidateFlagsInput<F>;
  readonly use?: Use;
  readonly onError?: ErrorHandler<
    EffectiveFlags<Use, NoInfer<F>>,
    InferMiddlewaresState<Use>
  >;
  readonly hidden?: boolean;
  readonly deprecated?: boolean | string;
  readonly examples?: MetaAsyncGetter<readonly ExampleInput[]>;
  readonly notes?: MetaAsyncGetter<readonly string[]>;
  readonly commands?: readonly CommandItem[];
  readonly meta?: CommandMeta;
}

export interface CommandOptions<
  Spec extends string = string,
  Args extends Partial<Record<ExtractArgNames<Spec>, any>> = {},
  Use extends readonly Middleware<any, any>[] = readonly [],
  F extends FlagsInput = {},
> extends CommandSharedOptions<Use, F> {
  readonly args?: ContextualArgs<Spec, Args>;
  readonly check?: CheckInput<
    InferCommandArgs<Spec, NoInfer<Args>>,
    EffectiveFlags<Use, NoInfer<F>>
  >;
  readonly stopParsing?: StopParsingOption;
  readonly complete?: CompletionOption<
    InferCommandArgs<Spec, NoInfer<Args>>,
    EffectiveFlags<Use, NoInfer<F>>
  >;
  readonly default?: never;
  readonly run?: CommandHandler<
    InferCommandArgs<Spec, NoInfer<Args>>,
    EffectiveFlags<Use, NoInfer<F>>,
    InferMiddlewaresState<Use>
  >;
}

export interface NamespaceCommandOptions<
  Use extends readonly Middleware<any, any>[] = readonly [],
  F extends FlagsInput = {},
> extends CommandSharedOptions<Use, F> {
  readonly args?: never;
  readonly check?: CheckInput<{}, EffectiveFlags<Use, NoInfer<F>>>;
  readonly complete?: CompletionOption<{}, EffectiveFlags<Use, NoInfer<F>>>;
  readonly default: Command;
  readonly run?: never;
}

const isCommand = (value: unknown): value is Command =>
  typeof value === "object" && value !== null && COMMAND_NODE in value;

export function flattenCommands(items?: readonly CommandItem[]): Command[] {
  if (!items || items.length === 0) {
    return [];
  }
  const out: Command[] = [];
  function visit(entry: CommandItem): void {
    if (Array.isArray(entry)) {
      for (const sub of entry) {
        visit(sub);
      }
    } else {
      out.push(entry as Command);
    }
  }
  for (const item of items) {
    visit(item);
  }

  return out;
}

export function command<
  Spec extends string,
  const Use extends readonly Middleware<any, any>[] = readonly [],
  const F extends FlagsInput = {},
>(spec: NonEmptySpec<Spec>, options: NamespaceCommandOptions<Use, F>): Command;
export function command<
  Spec extends string,
  Args extends Partial<Record<ExtractArgNames<Spec>, any>> = {},
  const Use extends readonly Middleware<any, any>[] = readonly [],
  const F extends FlagsInput = {},
>(
  spec: NonEmptySpec<Spec>,
  options: CommandOptions<Spec, Args, Use, F>,
): Command;
export function command(spec: string, opts: Record<string, any> = {}): Command {
  const parsed = parseCommandSpec(spec);
  if (!parsed.name) {
    throw new InvalidSchemaError(
      `command spec "${spec}" must include a command name; pass positional arguments directly to cli(spec, options) for a root command.`,
    );
  }

  if (opts.run && opts.default) {
    throw new InvalidSchemaError(
      'Cannot specify both "run" and "default" on the same command.',
    );
  }
  if (opts.default && parsed.argTokens.length > 0) {
    throw new InvalidSchemaError(
      'Namespace command with "default" cannot declare positional arguments in its own signature.',
    );
  }

  const children = opts.commands ? flattenCommands(opts.commands) : undefined;

  return {
    [COMMAND_NODE]: true,
    [COMMAND_ID]: Symbol(parsed.name),
    spec: spec.trim(),
    name: parsed.name,
    argTokens: parsed.argTokens,
    aliases: opts.aliases,
    description: opts.description,
    args: opts.args,
    flags: opts.flags,
    use: opts.use,
    check: opts.check,
    onError: opts.onError,
    stopParsing: opts.stopParsing,
    hidden: opts.hidden,
    deprecated: opts.deprecated,
    examples: opts.examples,
    notes: opts.notes,
    complete: opts.complete,
    commands: children,
    default: opts.default,
    run: opts.run,
    meta: opts.meta,
  };
}

export function use(
  middlewares: MaybeArray<Middleware<any, any>>,
  commands: CommandItem,
): Command[] {
  const mwList = toArray(middlewares);
  const flat = flattenCommands(Array.isArray(commands) ? commands : [commands]);

  return mwList.length === 0
    ? flat
    : flat.map((cmd) => ({
        ...cmd,
        use: cmd.use ? [...mwList, ...cmd.use] : mwList,
      }));
}

function containsCommand(value: unknown): boolean {
  if (isCommand(value)) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some(containsCommand);
  }

  return false;
}

export function group(title: string, commands: CommandItem): Command[];
export function group<const F extends FlagsInput>(
  title: string,
  flags: ValidateFlagsInput<F>,
): FlagsGroupNode<F>;
export function group(
  title: string,
  target: CommandItem | FlagsInput,
): Command[] | FlagsGroupNode {
  if (!title.trim()) {
    throw new InvalidSchemaError("Group title cannot be empty.");
  }

  if (
    containsCommand(target) ||
    (Array.isArray(target) && target.length === 0)
  ) {
    const flat = flattenCommands(
      Array.isArray(target)
        ? (target as readonly CommandItem[])
        : [target as Command],
    );

    return flat.map((cmd) => (cmd.group ? cmd : { ...cmd, group: title }));
  }

  return createFlagsGroup(title, target as FlagsInput);
}
