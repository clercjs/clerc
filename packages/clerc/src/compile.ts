import type { ArgDescriptor, CompiledArgs } from "./args";
import { compileArgs, parseCommandSpec } from "./args";
import type { CommandNode } from "./command-tree";
import { CommandTreeBuilder } from "./command-tree";
import { InvalidSchemaError, UnknownCommandError } from "./errors";
import type {
  CompiledFlagEntry,
  CompiledFlags,
  FlagDescriptor,
  FlagsDefinition,
} from "./flags";
import {
  buildCompiledFlags,
  compileFlagEntries,
  createBuiltinFlagDescriptor,
} from "./flags";
import type { ArgvFlagSpec, ArgvParser } from "./parser";
import { DOUBLE_DASH, createArgvParser } from "./parser";
import type { Plugin } from "./plugin";
import { collectPluginStates } from "./plugin";
import type { CompiledRules, RulesEntry } from "./rules";
import { EMPTY_RULES, compileRules, normalizeRulesInput } from "./rules";
import type { AnyMiddlewareFn, RegisteredMiddleware, Scope } from "./scope";
import { GROUP_SCOPES, createGroupBuckets, getScopeState } from "./scope";
import type {
  CliMeta,
  CliModel,
  CompletionContext,
  ErrorHandler,
  HelpOptions,
} from "./types";
import { EMPTY_ARRAY, formatVersion } from "./utils";

export interface CompiledNodeRuntime {
  readonly userFlags: CompiledFlags;
  readonly knownFlagNames: readonly string[];
  readonly parser: ArgvParser;
  readonly args?: CompiledArgs;
  readonly argsByName: ReadonlyMap<string, ArgDescriptor>;
  readonly rules: CompiledRules;
  readonly middlewares: readonly AnyMiddlewareFn[];
  readonly errorHandlers: readonly ErrorHandler<any, any>[];
  defaultAcceptsArgs: boolean;
  readonly hasBuiltinHelp: boolean;
  readonly hasBuiltinVersion: boolean;
  readonly hasBuiltinQuiet: boolean;
  readonly hasBuiltinVerbose: boolean;
}

export interface CompiledCli {
  readonly model: CliModel;
  readonly tree: CommandTreeBuilder;
  readonly rootRuntime: CompiledNodeRuntime;
  readonly runtimes: ReadonlyMap<CommandNode, CompiledNodeRuntime>;
}

interface CompileCliOptions {
  readonly root: Plugin<any, any>;
  readonly meta: CliMeta;
  readonly helpOptions: false | HelpOptions;
  readonly verbosity: boolean;
}

interface ResolvedScopeEnv {
  readonly scopedFlagEntries: readonly CompiledFlagEntry[];
  readonly scopedRuleEntries: readonly RulesEntry<any, any, any, any>[];
  readonly middlewares: readonly RegisteredMiddleware[];
  readonly errorHandlers: readonly ErrorHandler<any, any>[];
}

const ENFORCE_RANK = { pre: 0, normal: 1, post: 2 } as const;

const EMPTY_SCOPE_ENV: ResolvedScopeEnv = Object.freeze({
  scopedFlagEntries: EMPTY_ARRAY,
  scopedRuleEntries: EMPTY_ARRAY,
  middlewares: EMPTY_ARRAY,
  errorHandlers: EMPTY_ARRAY,
});

export const formatCliVersion = (meta: CliMeta): string =>
  `${meta.name} ${formatVersion(meta.version)}`.trim();

const appendIfAny = <T>(
  base: readonly T[],
  extra: readonly T[],
): readonly T[] => (extra.length > 0 ? [...base, ...extra] : base);

function mergeFlagEntries(
  base: readonly CompiledFlagEntry[],
  overrides: readonly CompiledFlagEntry[],
): readonly CompiledFlagEntry[] {
  if (overrides.length === 0) {
    return base;
  }
  if (base.length === 0) {
    return overrides;
  }
  const overrideNames = new Set(overrides.map((e) => e.name));

  return [...base.filter((e) => !overrideNames.has(e.name)), ...overrides];
}

function sortMiddlewares(
  registered: readonly RegisteredMiddleware[],
): readonly AnyMiddlewareFn[] {
  if (registered.length === 0) {
    return EMPTY_ARRAY;
  }

  return [...registered]
    .sort(
      (a, b) =>
        ENFORCE_RANK[a.enforce ?? "normal"] -
        ENFORCE_RANK[b.enforce ?? "normal"],
    )
    .map((m) => m.fn);
}

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

function resolveDefaultChildren(
  tree: CommandTreeBuilder,
  runtimes: ReadonlyMap<CommandNode, CompiledNodeRuntime>,
): void {
  for (const node of tree.walkNodes()) {
    const cmd = node.command;
    if (!cmd?.default) {
      continue;
    }
    const label =
      node.fullPath.length > 0
        ? `command "${node.fullPath.join(" ")}"`
        : "root command";
    if (!node.parent) {
      throw new InvalidSchemaError("root command cannot be marked as default");
    }
    if (!cmd.run) {
      throw new InvalidSchemaError(`default ${label} must have a run handler`);
    }
    if (node.parent.command?.run) {
      throw new InvalidSchemaError(
        `cannot mark ${label} as default when its parent command already has a run handler`,
      );
    }
    if (node.parent.defaultChild) {
      const parentLabel =
        node.parent.fullPath.length > 0
          ? `command "${node.parent.fullPath.join(" ")}"`
          : "CLI";

      throw new InvalidSchemaError(
        `${parentLabel} cannot have multiple default subcommands`,
      );
    }
    tree.setDefaultChild(node.parent, node);
    runtimes.get(node.parent)!.defaultAcceptsArgs =
      node.args.length > 0 || cmd.argTokens.includes(DOUBLE_DASH);
  }
}

interface NodeCompileShared {
  readonly tree: CommandTreeBuilder;
  readonly rawGlobalEntries: readonly CompiledFlagEntry[];
  readonly globalFlags: CompiledFlags;
  readonly globalRules: CompiledRules;
  readonly globalMiddlewares: readonly RegisteredMiddleware[];
  readonly sortedGlobalMiddlewares: readonly AnyMiddlewareFn[];
  readonly globalErrorHandlers: readonly ErrorHandler<any, any>[];
  readonly enableVerbosity: boolean;
  readonly enableVersion: boolean;
  readonly enableHelp: boolean;
}

function compileNodeRuntime(
  node: CommandNode,
  scopeEnv: ResolvedScopeEnv | undefined,
  shared: NodeCompileShared,
): CompiledNodeRuntime {
  const cmd = node.command;
  const isStandalone = Boolean(cmd?.standalone);
  const localEntries = cmd?.flags ? compileFlagEntries(cmd.flags) : EMPTY_ARRAY;
  const scopedEntries = isStandalone
    ? EMPTY_ARRAY
    : (scopeEnv?.scopedFlagEntries ?? EMPTY_ARRAY);
  const inheritedEntries = mergeFlagEntries(
    isStandalone ? EMPTY_ARRAY : shared.rawGlobalEntries,
    scopedEntries,
  );
  const nonGlobalEntries = mergeFlagEntries(scopedEntries, localEntries);
  const userFlags =
    !isStandalone && nonGlobalEntries.length === 0
      ? shared.globalFlags
      : buildCompiledFlags(mergeFlagEntries(inheritedEntries, localEntries));
  const localDescriptors = nonGlobalEntries.map((e) =>
    userFlags.byName.get(e.name)!,
  );

  const builtins = resolveNodeBuiltins({
    isRoot: node.fullPath.length === 0,
    isStandalone,
    enableVerbosity: shared.enableVerbosity,
    enableVersion: shared.enableVersion,
    enableHelp: shared.enableHelp,
    userFlags,
  });

  const compiledArgs = cmd ? compileArgs(cmd.argTokens, cmd.args) : undefined;
  const argsByName = new Map(
    (compiledArgs?.descriptors ?? EMPTY_ARRAY).map((a) => [a.name, a]),
  );

  const compiledScopedRules =
    !isStandalone && scopeEnv && scopeEnv.scopedRuleEntries.length > 0
      ? compileRules(
          scopeEnv.scopedRuleEntries,
          new Map(inheritedEntries.map((e) => [e.name, e])),
          new Set(),
        )
      : EMPTY_RULES;

  const compiledLocalRules = cmd?.rules
    ? compileRules(
        normalizeRulesInput(cmd.rules),
        userFlags.byName,
        new Set(argsByName.keys()),
      )
    : EMPTY_RULES;

  const activeRules: CompiledRules = {
    declarative: [
      ...(isStandalone ? EMPTY_ARRAY : shared.globalRules.declarative),
      ...compiledScopedRules.declarative,
      ...compiledLocalRules.declarative,
    ],
    custom: [
      ...(isStandalone ? EMPTY_ARRAY : shared.globalRules.custom),
      ...compiledScopedRules.custom,
      ...compiledLocalRules.custom,
    ],
    notes: [
      ...(isStandalone ? EMPTY_ARRAY : shared.globalRules.notes),
      ...compiledScopedRules.notes,
      ...compiledLocalRules.notes,
    ],
  };

  shared.tree.attachCompiled(node, {
    args: compiledArgs?.descriptors ?? EMPTY_ARRAY,
    localFlags: localDescriptors,
    builtinFlags: builtins.descriptors,
    rules: activeRules.declarative,
    ruleNotes: activeRules.notes,
  });

  return {
    userFlags,
    knownFlagNames: appendIfAny(userFlags.knownNames, builtins.names),
    parser: createArgvParser([...userFlags.specs, ...builtins.specs], {
      stopParsing: cmd?.stopParsing,
    }),
    args: compiledArgs,
    argsByName,
    rules: activeRules,
    middlewares: isStandalone
      ? EMPTY_ARRAY
      : scopeEnv && scopeEnv.middlewares.length > 0
        ? sortMiddlewares([
            ...shared.globalMiddlewares,
            ...scopeEnv.middlewares,
          ])
        : shared.sortedGlobalMiddlewares,
    errorHandlers:
      scopeEnv && scopeEnv.errorHandlers.length > 0
        ? [...shared.globalErrorHandlers, ...scopeEnv.errorHandlers]
        : shared.globalErrorHandlers,
    defaultAcceptsArgs: false,
    hasBuiltinHelp: builtins.hasHelp,
    hasBuiltinVersion: builtins.hasVersion,
    hasBuiltinQuiet: builtins.hasQuiet,
    hasBuiltinVerbose: builtins.hasVerbose,
  };
}

export function compileCli(options: CompileCliOptions): CompiledCli {
  const { root, meta, helpOptions, verbosity } = options;
  const states = collectPluginStates(root);
  const globalFlagsInput: FlagsDefinition = {};
  const globalRuleEntries: RulesEntry<any, any, any, any>[] = [];
  const groups = createGroupBuckets();
  const globalMiddlewares: RegisteredMiddleware[] = [];
  const globalErrorHandlers: ErrorHandler<any, any>[] = [];
  const tree = new CommandTreeBuilder();
  const nodeScopeEnvs = new Map<CommandNode, ResolvedScopeEnv>();

  function registerScopeTree(
    scope: Scope<any, any>,
    parentPrefix: readonly string[],
    parentEnv: ResolvedScopeEnv,
    parentDefaultGroup: string | undefined,
  ): void {
    const s = getScopeState(scope);
    const mountedStates =
      s.plugins.size > 0 ? collectPluginStates(s.plugins.values()) : [];
    const scopeStates = [...mountedStates, s];
    const fullPrefix = appendIfAny(parentPrefix, s.prefix);

    let scopedFlagEntries = parentEnv.scopedFlagEntries;
    let scopedRuleEntries = parentEnv.scopedRuleEntries;
    let middlewares = parentEnv.middlewares;
    let errorHandlers = parentEnv.errorHandlers;

    for (const state of scopeStates) {
      scopedFlagEntries = mergeFlagEntries(
        scopedFlagEntries,
        compileFlagEntries(state.flags),
      );
      scopedRuleEntries = appendIfAny(scopedRuleEntries, state.rules);
      middlewares = appendIfAny(middlewares, state.middlewares);
      errorHandlers = appendIfAny(errorHandlers, state.errorHandlers);
      for (const groupScope of GROUP_SCOPES) {
        groups[groupScope].push(...state.groups[groupScope]);
      }
    }

    const env: ResolvedScopeEnv = {
      scopedFlagEntries,
      scopedRuleEntries,
      middlewares,
      errorHandlers,
    };
    const defaultGroup = s.defaultGroup ?? parentDefaultGroup;

    if (s.namespaceMeta) {
      const metaWithGroup =
        parentPrefix.length === 0 && !s.namespaceMeta.group && defaultGroup
          ? { ...s.namespaceMeta, group: defaultGroup }
          : s.namespaceMeta;
      nodeScopeEnvs.set(tree.registerNamespace(fullPrefix, metaWithGroup), env);
    }

    for (const state of scopeStates) {
      for (const cmd of state.commands) {
        const cmdSegments = cmd.name ? cmd.name.split(/\s+/) : [];
        const fullName = appendIfAny(fullPrefix, cmdSegments).join(" ");
        const fullSpec = [fullName, ...cmd.argTokens].filter(Boolean).join(" ");
        const effectiveGroup =
          cmd.group ?? (fullPrefix.length === 0 ? defaultGroup : undefined);
        nodeScopeEnvs.set(
          tree.register({
            ...cmd,
            name: fullName,
            spec: fullSpec,
            group: effectiveGroup,
          }),
          env,
        );
      }

      for (const child of state.children) {
        registerScopeTree(child, fullPrefix, env, defaultGroup);
      }
    }
  }

  for (const state of states) {
    Object.assign(globalFlagsInput, state.flags);
    globalRuleEntries.push(...state.rules);
    globalMiddlewares.push(...state.middlewares);
    globalErrorHandlers.push(...state.errorHandlers);
    for (const groupScope of GROUP_SCOPES) {
      groups[groupScope].push(...state.groups[groupScope]);
    }
    for (const cmd of state.commands) {
      tree.register(cmd);
    }
    for (const childScope of state.children) {
      registerScopeTree(childScope, [], EMPTY_SCOPE_ENV, undefined);
    }
  }

  registerBuiltinCommands(tree, meta, helpOptions);

  const rawGlobalEntries = compileFlagEntries(globalFlagsInput);
  const globalFlags = buildCompiledFlags(rawGlobalEntries);
  const globalRules = compileRules(
    globalRuleEntries,
    globalFlags.byName,
    new Set(),
  );
  const sortedGlobalMiddlewares = sortMiddlewares(globalMiddlewares);
  const nodeCompileShared: NodeCompileShared = {
    tree,
    rawGlobalEntries,
    globalFlags,
    globalRules,
    globalMiddlewares,
    sortedGlobalMiddlewares,
    globalErrorHandlers,
    enableVerbosity: verbosity,
    enableVersion: Boolean(meta.version),
    enableHelp: helpOptions !== false,
  };
  const runtimes = new Map<CommandNode, CompiledNodeRuntime>();

  for (const node of tree.walkNodes()) {
    runtimes.set(
      node,
      compileNodeRuntime(node, nodeScopeEnvs.get(node), nodeCompileShared),
    );
  }

  resolveDefaultChildren(tree, runtimes);

  const model: CliModel = {
    meta,
    tree,
    globalFlags: globalFlags.entries,
    globalRules: globalRules.declarative,
    groups,
  };

  return {
    model,
    tree,
    rootRuntime: runtimes.get(tree.root)!,
    runtimes,
  };
}
