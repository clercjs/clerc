import type { ArgDescriptor } from "./args";
import { InvalidSchemaError } from "./errors";
import type { FlagDescriptor } from "./flags";
import type { ScanCallback, ScanResult } from "./parser";
import { DOUBLE_DASH } from "./parser";
import type { RuleDescriptor } from "./rules";
import type {
  AnyCommandDefinition,
  CliModel,
  SubcommandOptions,
} from "./types";
import type { Mutable } from "./utils";
import { EMPTY_ARRAY, toArray } from "./utils";

export interface CommandNode {
  readonly name: string;
  readonly fullPath: readonly string[];
  readonly parent?: CommandNode;
  readonly children: ReadonlyMap<string, CommandNode>;
  readonly aliasIndex: ReadonlyMap<string, CommandNode>;
  readonly aliases: readonly string[];
  readonly command?: AnyCommandDefinition;
  readonly defaultChild?: CommandNode;
  readonly args: readonly ArgDescriptor[];
  readonly localFlags: readonly FlagDescriptor[];
  readonly builtinFlags: readonly FlagDescriptor[];
  readonly rules: readonly RuleDescriptor[];
  readonly ruleNotes: readonly string[];
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

export interface GetCommandFlagsOptions {
  readonly includeBuiltins?: boolean;
}

export function getCommandFlags(
  model: CliModel,
  node: CommandNode,
  options: GetCommandFlagsOptions = {},
): readonly FlagDescriptor[] {
  const isStandalone = Boolean(node.command?.standalone);
  const localNames = new Set(node.localFlags.map((f) => f.name));

  return [
    ...(isStandalone
      ? []
      : model.globalFlags.filter((f) => !localNames.has(f.name))),
    ...node.localFlags,
    ...(options.includeBuiltins ? node.builtinFlags : []),
  ];
}

interface BaseCommandMatch {
  readonly node: CommandNode;
  readonly remainingArgv: readonly string[];
}

type CommandMatch = BaseCommandMatch &
  (
    | {
        readonly kind: "matched";
        readonly command: AnyCommandDefinition;
        readonly calledAs: string;
      }
    | { readonly kind: "namespace" | "empty" }
    | {
        readonly kind: "unknown";
        readonly commandName: string;
        readonly parentPath: readonly string[];
      }
  );

type ArgvScanFn = (
  args: readonly string[],
  onPositional: ScanCallback,
  startIndex?: number,
) => ScanResult;

interface MutableCommandNode extends Mutable<
  Omit<CommandNode, "parent" | "children" | "aliasIndex" | "defaultChild">
> {
  readonly parent?: MutableCommandNode;
  readonly children: Map<string, MutableCommandNode>;
  readonly aliasIndex: Map<string, MutableCommandNode>;
  defaultChild?: MutableCommandNode;
}

const createNode = (
  name: string,
  fullPath: readonly string[],
  parent?: MutableCommandNode,
): MutableCommandNode => ({
  name,
  fullPath,
  parent,
  children: new Map(),
  aliasIndex: new Map(),
  aliases: EMPTY_ARRAY,
  args: EMPTY_ARRAY,
  localFlags: EMPTY_ARRAY,
  builtinFlags: EMPTY_ARRAY,
  rules: EMPTY_ARRAY,
  ruleNotes: EMPTY_ARRAY,
});

const isVisibleNode = (node: CommandNode): boolean =>
  !node.command?.hidden && (Boolean(node.command) || node.children.size > 0);

export class CommandTreeBuilder implements CommandTree {
  readonly #root: MutableCommandNode = createNode("", []);
  readonly #namespaceNodes = new Set<MutableCommandNode>();

  public get root(): CommandNode {
    return this.#root;
  }

  #ensurePath(
    segments: readonly string[],
    checkAliasConflict: boolean,
  ): MutableCommandNode {
    let current = this.#root;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      let child = current.children.get(seg);
      if (!child) {
        if (checkAliasConflict && current.aliasIndex.has(seg)) {
          throw new InvalidSchemaError(
            `command "${segments.slice(0, i + 1).join(" ")}" conflicts with an existing alias`,
          );
        }
        child = createNode(seg, segments.slice(0, i + 1), current);
        current.children.set(seg, child);
      }
      current = child;
    }

    return current;
  }

  #registerAliases(
    current: MutableCommandNode,
    targetLabel: string,
    rawAliases: readonly string[],
  ): void {
    if (rawAliases.length === 0) {
      return;
    }
    const normalizedAliases = [...current.aliases];
    const defaultAliasHost = current.parent ?? this.#root;
    for (const rawAlias of rawAliases) {
      const alias = rawAlias.trim();
      if (alias === "") {
        throw new InvalidSchemaError(
          `${targetLabel} cannot have an empty alias`,
        );
      }
      normalizedAliases.push(alias);

      const aliasSegments = alias.split(/\s+/);
      const leaf = aliasSegments.at(-1)!;
      const host =
        aliasSegments.length > 1
          ? this.#ensurePath(aliasSegments.slice(0, -1), false)
          : defaultAliasHost;

      if (host.children.has(leaf) || host.aliasIndex.has(leaf)) {
        throw new InvalidSchemaError(`alias "${alias}" already exists`);
      }
      host.aliasIndex.set(leaf, current);
    }
    current.aliases = normalizedAliases;
  }

  public registerNamespace(
    segments: readonly string[],
    meta: SubcommandOptions,
  ): CommandNode {
    const current = this.#ensurePath(segments, true);
    const fullName = segments.join(" ");
    const targetLabel = `command "${fullName}"`;
    if (current.command) {
      throw new InvalidSchemaError(`${targetLabel} already exists`);
    }

    current.command = {
      ...meta,
      spec: fullName,
      name: fullName,
      argTokens: [],
    };
    this.#namespaceNodes.add(current);
    this.#registerAliases(
      current,
      targetLabel,
      meta.aliases ? toArray(meta.aliases) : [],
    );

    return current;
  }

  public register(cmd: AnyCommandDefinition): CommandNode {
    const rawName = cmd.name.trim();
    const segments = rawName === "" ? [] : rawName.split(/\s+/);
    const current = this.#ensurePath(segments, true);

    const targetLabel =
      segments.length === 0
        ? "root command"
        : `command "${segments.join(" ")}"`;

    if (current.command) {
      if (this.#namespaceNodes.has(current)) {
        const ns = current.command;
        current.command = {
          ...ns,
          ...cmd,
          description: cmd.description ?? ns.description,
          group: cmd.group ?? ns.group,
          hidden: cmd.hidden ?? ns.hidden,
          deprecated: cmd.deprecated ?? ns.deprecated,
          examples: cmd.examples ?? ns.examples,
          notes: cmd.notes ?? ns.notes,
          meta: ns.meta || cmd.meta ? { ...ns.meta, ...cmd.meta } : undefined,
        };
        this.#namespaceNodes.delete(current);
        this.#registerAliases(
          current,
          targetLabel,
          cmd.aliases ? toArray(cmd.aliases) : [],
        );

        return current;
      }

      throw new InvalidSchemaError(`${targetLabel} already exists`);
    }

    current.command = cmd;
    this.#registerAliases(
      current,
      targetLabel,
      cmd.aliases ? toArray(cmd.aliases) : [],
    );

    return current;
  }

  /**
   * @internal
   */
  public setDefaultChild(parent: CommandNode, child: CommandNode): void {
    (parent as MutableCommandNode).defaultChild = child as MutableCommandNode;
  }

  /**
   * @internal
   */
  public attachCompiled(
    node: CommandNode,
    compiled: Pick<
      CommandNode,
      "args" | "localFlags" | "builtinFlags" | "rules" | "ruleNotes"
    >,
  ): void {
    Object.assign(node as MutableCommandNode, compiled);
  }

  public findNode(path: readonly string[]): CommandNode | undefined {
    let current: CommandNode = this.#root;
    for (const seg of path) {
      const next = current.children.get(seg) ?? current.aliasIndex.get(seg);
      if (!next) {
        return undefined;
      }
      current = next;
    }

    return current;
  }

  public listChildren(node: CommandNode = this.#root): readonly CommandNode[] {
    return [...node.children.values()];
  }

  public listVisibleChildren(
    node: CommandNode = this.#root,
  ): readonly CommandNode[] {
    return [...node.children.values()].filter(isVisibleNode);
  }

  public walkNodes(): readonly CommandNode[] {
    const result: CommandNode[] = [];
    function visit(node: CommandNode): void {
      result.push(node);
      for (const child of node.children.values()) {
        visit(child);
      }
    }
    visit(this.#root);

    return result;
  }

  public walkCommands(): readonly (CommandNode & {
    readonly command: AnyCommandDefinition;
  })[] {
    return this.walkNodes().filter(
      (
        node,
      ): node is CommandNode & { readonly command: AnyCommandDefinition } =>
        node.command !== undefined,
    );
  }

  public resolveArgv(
    argv: readonly string[],
    getScan: (node: CommandNode) => ArgvScanFn,
  ): CommandMatch {
    let current: CommandNode = this.#root;
    const calledTokens: string[] = [];
    const matchedIndices: number[] = [];
    let isContiguousPrefix = true;
    let startIndex = 0;
    let finalStoppedAt = argv.length;

    while (startIndex < argv.length) {
      let matched = false;
      const { stoppedAt } = getScan(current)(
        argv,
        (token, index) => {
          const nextNode =
            current.children.get(token) ?? current.aliasIndex.get(token);
          if (!nextNode) {
            return false;
          }
          if (index !== matchedIndices.length) {
            isContiguousPrefix = false;
          }
          current = nextNode;
          calledTokens.push(token);
          matchedIndices.push(index);
          startIndex = index + 1;
          matched = true;

          return false;
        },
        startIndex,
      );
      if (!matched) {
        finalStoppedAt = stoppedAt;

        break;
      }
    }

    let remainingArgv: readonly string[];
    if (matchedIndices.length === 0) {
      remainingArgv = argv;
    } else if (isContiguousPrefix) {
      remainingArgv = argv.slice(matchedIndices.length);
    } else {
      const matchedSet = new Set(matchedIndices);
      remainingArgv = argv.filter((_, index) => !matchedSet.has(index));
    }

    if (current.command?.run) {
      return {
        kind: "matched",
        node: current,
        command: current.command,
        calledAs: calledTokens.join(" "),
        remainingArgv,
      };
    }

    const stoppedToken = argv[finalStoppedAt];
    const leadingPositional =
      stoppedToken &&
      stoppedToken !== DOUBLE_DASH &&
      !stoppedToken.startsWith("-")
        ? stoppedToken
        : undefined;

    if (leadingPositional) {
      const parentPath = current.fullPath;
      const commandName =
        parentPath.length > 0
          ? [...parentPath, leadingPositional].join(" ")
          : leadingPositional;

      return {
        kind: "unknown",
        node: current,
        commandName,
        parentPath,
        remainingArgv,
      };
    }

    if (current.fullPath.length > 0) {
      return {
        kind: "namespace",
        node: current,
        remainingArgv,
      };
    }

    return {
      kind: "empty",
      node: current,
      remainingArgv,
    };
  }
}
