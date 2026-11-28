import type { CompiledArgs } from "./args";
import { compileArgs, parseCommandSpec } from "./args";
import type { CheckFn, CheckInput } from "./check";
import { collectChecks } from "./check";
import type { Command } from "./command";
import { COMMAND_ID, COMMAND_NODE } from "./command";
import type { CommandNode } from "./command-tree";
import { CommandTreeBuilder } from "./command-tree";
import { InvalidSchemaError, UnknownCommandError } from "./errors";
import type {
  CompiledFlags,
  FlagConstraint,
  FlagDescriptor,
  FlagsInput,
} from "./flags";
import { compileFlagsInputs, createBuiltinFlagDescriptor } from "./flags";
import type { Middleware } from "./middleware";
import { expandMiddlewares } from "./middleware";
import type { ArgvFlagSpec, ArgvParser } from "./parser";
import { DOUBLE_DASH, createArgvParser } from "./parser";
import type {
  CliMeta,
  CliModel,
  CompletionContext,
  ErrorHandler,
  GroupDefinition,
  HelpOptions,
} from "./types";
import { formatVersion } from "./utils";

export interface CompiledNodeRuntime {
  readonly userFlags: CompiledFlags;
  readonly knownFlagNames: readonly string[];
  readonly parser: ArgvParser;
  readonly args?: CompiledArgs;
  readonly constraints: readonly FlagConstraint[];
  readonly checks: readonly CheckFn[];
  readonly middlewares: readonly Middleware<any, any>[];
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

interface CompileCliInput {
  readonly meta: CliMeta;
  readonly helpOptions: false | HelpOptions;
  readonly verbosity: boolean;
  readonly use?: readonly Middleware<any, any>[];
  readonly flags?: FlagsInput;
  readonly check?: CheckInput<any, any>;
  readonly onError?: ErrorHandler<any, any>;
  readonly rootCommand?: Command;
  readonly commands: readonly Command[];
  readonly defaultCommand?: Command;
}

interface ScopeEnv {
  readonly middlewares: readonly Middleware<any, any>[];
  readonly directFlagInputs: readonly FlagsInput[];
  readonly directChecks: readonly CheckInput<any, any>[];
  readonly directErrorHandlers: readonly ErrorHandler<any, any>[];
}

const EMPTY_ENV: ScopeEnv = {
  middlewares: [],
  directFlagInputs: [],
  directChecks: [],
  directErrorHandlers: [],
};

export const formatCliVersion = (meta: CliMeta): string =>
  `${meta.name} ${formatVersion(meta.version)}`.trim();

function resolveNodeBuiltins(
  isRoot: boolean,
  isBuiltinCommand: boolean,
  enableVerbosity: boolean,
  enableVersion: boolean,
  enableHelp: boolean,
  userFlags: CompiledFlags,
) {
  const usedNames = new Set(userFlags.knownNames);
  const usedShorts = new Set(
    userFlags.specs.map((s) => s.short).filter((s): s is string => Boolean(s)),
  );
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
      !isBuiltinCommand &&
      enableVerbosity &&
      tryAdd("quiet", "q", "Suppress non-error output"),
    hasVerbose:
      !isBuiltinCommand &&
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
  envs: Map<CommandNode, ScopeEnv>,
): void {
  if (meta.version && !tree.findNode(["version"])) {
    const node = tree.register({
      [COMMAND_NODE]: true,
      [COMMAND_ID]: Symbol("builtin:version"),
      spec: "version",
      name: "version",
      argTokens: [],
      description: "Show version",
      builtin: true,
      run(ctx) {
        ctx.terminal.stdout(formatCliVersion(ctx.model.meta));
      },
    });
    envs.set(node, EMPTY_ENV);
  }

  if (
    helpOptions !== false &&
    helpOptions.command !== false &&
    !tree.findNode(["help"])
  ) {
    const { name, argTokens } = parseCommandSpec("help [command...]");
    const node = tree.register({
      [COMMAND_NODE]: true,
      [COMMAND_ID]: Symbol("builtin:help"),
      spec: "help [command...]",
      name,
      argTokens,
      description: "Show help for a command",
      builtin: true,
      args: {
        command: {
          description: "Command to inspect",
          complete({ words, model }: CompletionContext) {
            const parent =
              words.length > 0 ? model.tree.findNode(words) : model.tree.root;

            return parent
              ? model.tree
                  .listVisibleChildren(parent)
                  .filter((c) => c.command?.complete !== false)
                  .map((c) => ({
                    value: c.name,
                    description: c.command?.description ?? "",
                  }))
              : [];
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
    envs.set(node, EMPTY_ENV);
  }
}

function appendUniqueGroup(
  list: GroupDefinition[],
  seen: Set<string>,
  key: string,
  title = key,
): void {
  if (!seen.has(key)) {
    seen.add(key);
    list.push({ key, title });
  }
}

export function compileCli(input: CompileCliInput): CompiledCli {
  const { meta, helpOptions, verbosity } = input;
  const globalMiddlewares = expandMiddlewares(input.use ?? []);
  const globalMwSet = new Set(globalMiddlewares);
  const rootEnv: ScopeEnv = {
    middlewares: globalMiddlewares,
    directFlagInputs: input.flags ? [input.flags] : [],
    directChecks: input.check ? [input.check] : [],
    directErrorHandlers: input.onError ? [input.onError] : [],
  };

  const globalFlagInputs: FlagsInput[] = [
    ...globalMiddlewares
      .map((m) => m.flags)
      .filter((f): f is FlagsInput => Boolean(f)),
    ...rootEnv.directFlagInputs,
  ];
  const globalFlagSet = compileFlagsInputs(globalFlagInputs);

  const commandGroups: GroupDefinition[] = [];
  const seenCommandGroups = new Set<string>();
  const flagGroups: GroupDefinition[] = [...globalFlagSet.groups];
  const seenFlagGroups = new Set(flagGroups.map((g) => g.key));

  const tree = new CommandTreeBuilder();
  const envs = new Map<CommandNode, ScopeEnv>();
  const pendingDefaults: {
    readonly parent: CommandNode;
    readonly target: Command;
  }[] = [];

  if (input.rootCommand) {
    tree.register(input.rootCommand);
  }
  envs.set(tree.root, rootEnv);

  function registerSubtree(
    cmd: Command,
    prefix: readonly string[],
    parentEnv: ScopeEnv,
  ): CommandNode {
    const middlewares =
      cmd.use && cmd.use.length > 0
        ? expandMiddlewares([...parentEnv.middlewares, ...cmd.use])
        : parentEnv.middlewares;
    const env: ScopeEnv = {
      middlewares,
      directFlagInputs: cmd.flags
        ? [...parentEnv.directFlagInputs, cmd.flags]
        : parentEnv.directFlagInputs,
      directChecks: cmd.check
        ? [...parentEnv.directChecks, cmd.check]
        : parentEnv.directChecks,
      directErrorHandlers: cmd.onError
        ? [...parentEnv.directErrorHandlers, cmd.onError]
        : parentEnv.directErrorHandlers,
    };

    const cmdSegments = cmd.name ? cmd.name.split(/\s+/) : [];
    const fullSegments = [...prefix, ...cmdSegments];
    const fullName = fullSegments.join(" ");
    const fullSpec = [fullName, ...cmd.argTokens].filter(Boolean).join(" ");

    if (cmd.group) {
      appendUniqueGroup(commandGroups, seenCommandGroups, cmd.group);
    }

    const registeredCmd: Command =
      fullName === cmd.name && fullSpec === cmd.spec
        ? cmd
        : { ...cmd, name: fullName, spec: fullSpec };
    const node = tree.register(registeredCmd);
    envs.set(node, env);

    const childList = cmd.commands ? [...cmd.commands] : [];
    if (
      cmd.default &&
      !childList.some((c) => c[COMMAND_ID] === cmd.default![COMMAND_ID])
    ) {
      childList.push(cmd.default);
    }

    let resolvedDefaultNode: CommandNode | undefined;
    for (const child of childList) {
      const childNode = registerSubtree(child, fullSegments, env);
      if (child[COMMAND_ID] === cmd.default?.[COMMAND_ID]) {
        resolvedDefaultNode = childNode;
      }
    }

    if (cmd.default) {
      pendingDefaults.push({
        parent: node,
        target: resolvedDefaultNode?.command ?? cmd.default,
      });
    }

    return node;
  }

  const rootCommands = [...input.commands];
  if (
    input.defaultCommand &&
    !rootCommands.some(
      (c) => c[COMMAND_ID] === input.defaultCommand![COMMAND_ID],
    )
  ) {
    rootCommands.push(input.defaultCommand);
  }

  for (const cmd of rootCommands) {
    registerSubtree(cmd, [], rootEnv);
  }

  if (input.defaultCommand) {
    pendingDefaults.push({ parent: tree.root, target: input.defaultCommand });
  }

  registerBuiltinCommands(tree, meta, helpOptions, envs);

  const enableVersion = Boolean(meta.version);
  const enableHelp = helpOptions !== false;
  const runtimes = new Map<CommandNode, CompiledNodeRuntime>();
  const nodeByCommandId = new Map<symbol, CommandNode>();

  for (const node of tree.walkNodes()) {
    const cmd = node.command;
    if (cmd) {
      nodeByCommandId.set(cmd[COMMAND_ID], node);
    }
    const isBuiltinCommand = Boolean(cmd?.builtin);
    const env = envs.get(node) ?? rootEnv;

    const scopedMiddlewares = isBuiltinCommand
      ? []
      : env.middlewares.filter((m) => !globalMwSet.has(m));
    const scopedDirectFlags = isBuiltinCommand
      ? []
      : env.directFlagInputs.slice(rootEnv.directFlagInputs.length);
    const localFlagInputs: FlagsInput[] = [
      ...scopedMiddlewares
        .map((m) => m.flags)
        .filter((f): f is FlagsInput => Boolean(f)),
      ...scopedDirectFlags,
    ];

    let compiledFlagSet = globalFlagSet;
    let localFlags: readonly FlagDescriptor[] = [];

    if (isBuiltinCommand) {
      compiledFlagSet = compileFlagsInputs([]);
    } else if (localFlagInputs.length > 0) {
      const localOnlySet = compileFlagsInputs(localFlagInputs);
      for (const g of localOnlySet.groups) {
        appendUniqueGroup(flagGroups, seenFlagGroups, g.key, g.title);
      }
      compiledFlagSet = compileFlagsInputs([
        ...globalFlagInputs,
        ...localFlagInputs,
      ]);
      localFlags = [...localOnlySet.declaredNames].map((name) =>
        compiledFlagSet.flags.byName.get(name)!,
      );
    }

    const userFlags = compiledFlagSet.flags;
    const builtins = resolveNodeBuiltins(
      node.fullPath.length === 0,
      isBuiltinCommand,
      verbosity,
      enableVersion,
      enableHelp,
      userFlags,
    );

    const args = cmd ? compileArgs(cmd.argTokens, cmd.args) : undefined;

    const checks = collectChecks([
      ...env.middlewares.map((m) => m.check),
      ...env.directChecks,
    ]);

    tree.attachCompiled(node, {
      args: args?.descriptors ?? [],
      localFlags,
      builtinFlags: builtins.descriptors,
      constraints: compiledFlagSet.constraints,
    });

    const mwErrorHandlers = env.middlewares
      .map((m) => m.onError)
      .filter((fn): fn is ErrorHandler<any, any> => Boolean(fn));
    const errorHandlers = isBuiltinCommand
      ? []
      : [
          ...rootEnv.directErrorHandlers,
          ...mwErrorHandlers,
          ...env.directErrorHandlers.slice(rootEnv.directErrorHandlers.length),
        ];

    runtimes.set(node, {
      userFlags,
      knownFlagNames: [...userFlags.knownNames, ...builtins.names],
      parser: createArgvParser([...userFlags.specs, ...builtins.specs], {
        stopParsing: cmd?.stopParsing,
      }),
      args,
      constraints: compiledFlagSet.constraints,
      checks,
      middlewares: env.middlewares,
      errorHandlers,
      defaultAcceptsArgs: false,
      hasBuiltinHelp: builtins.hasHelp,
      hasBuiltinVersion: builtins.hasVersion,
      hasBuiltinQuiet: builtins.hasQuiet,
      hasBuiltinVerbose: builtins.hasVerbose,
    });
  }

  for (const { parent, target } of pendingDefaults) {
    const parentLabel =
      parent.fullPath.length > 0
        ? `command "${parent.fullPath.join(" ")}"`
        : "CLI";
    if (!target.name) {
      throw new InvalidSchemaError(
        `${parentLabel} default command must have a name; define run() directly on ${parentLabel} instead.`,
      );
    }
    if (!target.run) {
      throw new InvalidSchemaError(
        `default command "${target.name}" on ${parentLabel} must have a run handler.`,
      );
    }
    if (parent.command?.run) {
      throw new InvalidSchemaError(
        `cannot set default command "${target.name}" when ${parentLabel} already has a run handler.`,
      );
    }
    const childNode = nodeByCommandId.get(target[COMMAND_ID]);
    if (childNode?.parent !== parent) {
      throw new InvalidSchemaError(
        `default command "${target.name}" must be a direct subcommand of ${parentLabel}.`,
      );
    }
    tree.setDefaultChild(parent, childNode);
    runtimes.get(parent)!.defaultAcceptsArgs =
      childNode.args.length > 0 ||
      childNode.command!.argTokens.includes(DOUBLE_DASH);
  }

  return {
    model: {
      meta,
      tree,
      globalFlags: globalFlagSet.flags.entries,
      groups: {
        commands: commandGroups,
        flags: flagGroups,
      },
    },
    tree,
    rootRuntime: runtimes.get(tree.root)!,
    runtimes,
  };
}
