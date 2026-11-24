import type { ArgDescriptor, CompiledArgs } from "./args";
import { compileArgs, parseCommandSpec } from "./args";
import type { CommandNode } from "./command-tree";
import { CommandTreeBuilder } from "./command-tree";
import { InvalidSchemaError, UnknownCommandError } from "./errors";
import type { CompiledFlags, FlagDescriptor, FlagsDefinition } from "./flags";
import {
  buildCompiledFlags,
  compileFlagEntries,
  createBuiltinFlagDescriptor,
} from "./flags";
import type { ArgvFlagSpec, ArgvParser } from "./parser";
import { DOUBLE_DASH, createArgvParser } from "./parser";
import type { AnyMiddlewareFn, Plugin, RegisteredMiddleware } from "./plugin";
import {
  GROUP_SCOPES,
  collectPluginStates,
  createGroupBuckets,
} from "./plugin";
import type { CompiledRules, RulesFactory } from "./rules";
import { EMPTY_RULES, compileRules } from "./rules";
import type {
  CliMeta,
  CliModel,
  CompletionContext,
  ErrorHandler,
  HelpOptions,
} from "./types";
import { formatVersion } from "./utils";

export interface CompiledNodeRuntime {
  readonly userFlags: CompiledFlags;
  readonly knownFlagNames: readonly string[];
  readonly parser: ArgvParser;
  readonly args?: CompiledArgs;
  readonly argsByName: ReadonlyMap<string, ArgDescriptor>;
  readonly rules: CompiledRules;
  readonly hasBuiltinHelp: boolean;
  readonly hasBuiltinVersion: boolean;
  readonly hasBuiltinQuiet: boolean;
  readonly hasBuiltinVerbose: boolean;
}

export interface CompiledCli {
  readonly model: CliModel;
  readonly tree: CommandTreeBuilder;
  readonly defaultNode?: CommandNode;
  readonly defaultAcceptsArgs: boolean;
  readonly globalRules: CompiledRules;
  readonly middlewares: readonly AnyMiddlewareFn[];
  readonly errorHandlers: readonly ErrorHandler<any, any>[];
  readonly rootRuntime: CompiledNodeRuntime;
  readonly runtimes: ReadonlyMap<CommandNode, CompiledNodeRuntime>;
}

export interface CompileCliOptions {
  readonly root: Plugin<any, any>;
  readonly meta: CliMeta;
  readonly defaultCommand?: string;
  readonly helpOptions: false | HelpOptions;
  readonly verbosity: boolean;
}

const EMPTY_DESCRIPTORS: readonly never[] = Object.freeze([]);
const ENFORCE_RANK = { pre: 0, normal: 1, post: 2 } as const;

export const formatCliVersion = (meta: CliMeta): string =>
  `${meta.name} ${formatVersion(meta.version)}`.trim();

function resolveNodeBuiltins(options: {
  readonly isRoot: boolean;
  readonly isStandalone: boolean;
  readonly enableVerbosity: boolean;
  readonly enableVersion: boolean;
  readonly enableHelp: boolean;
  readonly userFlags: CompiledFlags;
}): {
  readonly descriptors: readonly FlagDescriptor[];
  readonly specs: readonly ArgvFlagSpec[];
  readonly names: readonly string[];
  readonly hasQuiet: boolean;
  readonly hasVerbose: boolean;
  readonly hasHelp: boolean;
  readonly hasVersion: boolean;
} {
  const {
    isRoot,
    isStandalone,
    enableVerbosity,
    enableVersion,
    enableHelp,
    userFlags,
  } = options;
  const usedNames = new Set(userFlags.knownNames);
  const usedShorts = new Set<string>();
  for (const spec of userFlags.specs) {
    if (spec.short) {
      usedShorts.add(spec.short);
    }
  }

  const descriptors: FlagDescriptor[] = [];
  const specs: ArgvFlagSpec[] = [];
  const names: string[] = [];

  function tryAdd(
    key: string,
    shortChar: string,
    desc: string,
    kind: "boolean" | "counter" = "boolean",
  ): boolean {
    if (usedNames.has(key)) {
      return false;
    }
    const short = usedShorts.has(shortChar) ? undefined : shortChar;
    if (short) {
      usedShorts.add(short);
    }
    descriptors.push(createBuiltinFlagDescriptor(key, short, desc, kind));
    specs.push({ key, kind, short, negatable: false });
    names.push(key);

    return true;
  }

  return {
    descriptors,
    specs,
    names,
    hasQuiet:
      !isStandalone &&
      enableVerbosity &&
      tryAdd("quiet", "q", "Suppress non-error output"),
    hasVerbose:
      !isStandalone &&
      enableVerbosity &&
      tryAdd("verbose", "v", "Enable verbose debug logging", "counter"),
    hasVersion:
      isRoot && enableVersion && tryAdd("version", "V", "Show version"),
    hasHelp: enableHelp && tryAdd("help", "h", "Show help"),
  };
}

function registerBuiltinCommands(
  tree: CommandTreeBuilder,
  meta: CliMeta,
  helpOptions: false | HelpOptions,
): void {
  if (meta.version && !tree.findNode(["version"])) {
    tree.register({
      spec: "version",
      name: "version",
      argTokens: [],
      description: "Show version",
      builtin: true,
      standalone: true,
      run(ctx) {
        ctx.terminal.stdout(formatCliVersion(ctx.model.meta));
      },
    });
  }
  if (
    helpOptions !== false &&
    helpOptions.command !== false &&
    !tree.findNode(["help"])
  ) {
    const { name, argTokens } = parseCommandSpec("help [command...]");
    tree.register({
      spec: "help [command...]",
      name,
      argTokens,
      description: "Show help for a command",
      builtin: true,
      standalone: true,
      args: {
        command: {
          description: "Command to inspect",
          complete({ words, model }: CompletionContext) {
            const parent =
              words.length > 0 ? model.tree.findNode(words) : model.tree.root;
            if (!parent) {
              return [];
            }

            return model.tree
              .listVisibleChildren(parent)
              .filter((child) => child.command?.complete !== false)
              .map((child) => ({
                value: child.name,
                description: child.command?.description ?? "",
              }));
          },
        },
      },
      examples: (m) => [
        [`$ ${m.name} help`, "Show general help"],
        [`$ ${m.name} help <command>`, "Show help for a command"],
      ],
      async run(ctx) {
        const path = ctx.args.command as string[];
        if (path.length > 0 && !ctx.model.tree.findNode(path)) {
          let parentPath: readonly string[] = [];
          for (let i = 1; i < path.length; i++) {
            const matched = ctx.model.tree.findNode(path.slice(0, i));
            if (!matched) {
              break;
            }
            parentPath = matched.fullPath;
          }

          throw new UnknownCommandError(path.join(" "), parentPath);
        }
        await ctx.help.print(path.length > 0 ? path : undefined);
      },
    });
  }
}

export function compileCli(options: CompileCliOptions): CompiledCli {
  const { root, meta, defaultCommand, helpOptions, verbosity } = options;
  const states = collectPluginStates(root);
  const globalFlagsInput: FlagsDefinition = {};
  const globalRuleFactories: RulesFactory<any, any, any, any>[] = [];
  const groups = createGroupBuckets();
  const registeredMiddlewares: RegisteredMiddleware[] = [];
  const errorHandlers: ErrorHandler<any, any>[] = [];
  const tree = new CommandTreeBuilder();

  for (const state of states) {
    Object.assign(globalFlagsInput, state.flags);
    globalRuleFactories.push(...state.rules);
    registeredMiddlewares.push(...state.middlewares);
    errorHandlers.push(...state.errorHandlers);
    for (const scope of GROUP_SCOPES) {
      groups[scope].push(...state.groups[scope]);
    }
    for (const cmd of state.commands) {
      tree.register(cmd);
    }
  }

  registerBuiltinCommands(tree, meta, helpOptions);

  const rawGlobalEntries = compileFlagEntries(globalFlagsInput);
  const globalFlags = buildCompiledFlags(rawGlobalEntries);
  const globalRules = compileRules(
    globalRuleFactories,
    new Set(globalFlags.byName.keys()),
    new Set(),
  );
  const enableVersion = Boolean(meta.version);
  const enableHelp = helpOptions !== false;
  const runtimes = new Map<CommandNode, CompiledNodeRuntime>();

  for (const node of tree.walkNodes()) {
    const isRoot = node.fullPath.length === 0;
    const cmd = node.command;
    const isNodeStandalone = Boolean(cmd?.standalone);
    const localEntries = cmd?.flags ? compileFlagEntries(cmd.flags) : undefined;
    let userFlags = globalFlags;
    let localDescriptors: readonly FlagDescriptor[] = EMPTY_DESCRIPTORS;
    if (localEntries && localEntries.length > 0) {
      const localNames = new Set(localEntries.map((e) => e.name));
      userFlags = buildCompiledFlags([
        ...rawGlobalEntries.filter((e) => !localNames.has(e.name)),
        ...localEntries,
      ]);
      localDescriptors = localEntries.map((e) => userFlags.byName.get(e.name)!);
    }
    const builtins = resolveNodeBuiltins({
      isRoot,
      isStandalone: isNodeStandalone,
      enableVerbosity: verbosity,
      enableVersion,
      enableHelp,
      userFlags,
    });

    const parser = createArgvParser([...userFlags.specs, ...builtins.specs], {
      stopAtFirstPositional: cmd?.stopAtFirstPositional,
    });
    const compiledArgs = cmd ? compileArgs(cmd.argTokens, cmd.args) : undefined;
    const argsByName = new Map(
      (compiledArgs?.descriptors ?? EMPTY_DESCRIPTORS).map((a) => [a.name, a]),
    );
    const validFlagNames = new Set(
      isNodeStandalone
        ? localDescriptors.map((f) => f.name)
        : userFlags.byName.keys(),
    );
    const compiledNodeRules = cmd?.rules
      ? compileRules([cmd.rules], validFlagNames, new Set(argsByName.keys()))
      : EMPTY_RULES;

    tree.attachCompiled(node, {
      args: compiledArgs?.descriptors ?? EMPTY_DESCRIPTORS,
      localFlags: localDescriptors,
      builtinFlags: builtins.descriptors,
      rules: compiledNodeRules.declarative,
    });

    runtimes.set(node, {
      userFlags,
      knownFlagNames:
        builtins.names.length > 0
          ? [...userFlags.knownNames, ...builtins.names]
          : userFlags.knownNames,
      parser,
      args: compiledArgs,
      argsByName,
      rules: compiledNodeRules,
      hasBuiltinHelp: builtins.hasHelp,
      hasBuiltinVersion: builtins.hasVersion,
      hasBuiltinQuiet: builtins.hasQuiet,
      hasBuiltinVerbose: builtins.hasVerbose,
    });
  }

  let defaultNode: CommandNode | undefined;
  let defaultAcceptsArgs = false;
  if (defaultCommand !== undefined) {
    const trimmedDefault = defaultCommand.trim();
    if (trimmedDefault === "") {
      throw new InvalidSchemaError(
        "defaultCommand cannot be empty; register a root command with cli.command({ ... }) instead",
      );
    }
    if (tree.root.command) {
      throw new InvalidSchemaError(
        "cannot specify defaultCommand when a root command is already registered",
      );
    }
    const target = tree.findNode(trimmedDefault.split(/\s+/));
    if (!target?.command?.run) {
      throw new InvalidSchemaError(
        `defaultCommand "${trimmedDefault}" does not match a runnable command`,
      );
    }
    defaultNode = target;
    defaultAcceptsArgs =
      target.args.length > 0 || target.command.argTokens.includes(DOUBLE_DASH);
  }

  const model: CliModel = {
    meta,
    tree,
    defaultCommand: defaultNode?.fullPath,
    globalFlags: globalFlags.entries,
    globalRules: globalRules.declarative,
    groups,
  };

  registeredMiddlewares.sort(
    (a, b) =>
      ENFORCE_RANK[a.enforce ?? "normal"] - ENFORCE_RANK[b.enforce ?? "normal"],
  );

  return {
    model,
    tree,
    defaultNode,
    defaultAcceptsArgs,
    globalRules,
    middlewares: registeredMiddlewares.map((m) => m.fn),
    errorHandlers,
    rootRuntime: runtimes.get(tree.root)!,
    runtimes,
  };
}
