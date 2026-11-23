import { InvalidCommandError } from "./errors";
import type { ScanCallback, ScanResult } from "./parser";
import { DOUBLE_DASH } from "./parser";
import type {
  AnyCommandDefinition,
  ArgDescriptor,
  CommandNode,
  CommandTree,
  FlagDescriptor,
} from "./types";
import { toArray } from "./utils";

export type CommandMatch =
  | {
      readonly kind: "matched";
      readonly node: CommandNode;
      readonly command: AnyCommandDefinition;
      readonly calledAs: string;
      readonly remainingArgv: readonly string[];
    }
  | {
      readonly kind: "namespace";
      readonly node: CommandNode;
      readonly remainingArgv: readonly string[];
    }
  | {
      readonly kind: "empty";
      readonly node: CommandNode;
      readonly remainingArgv: readonly string[];
    }
  | {
      readonly kind: "unknown";
      readonly node: CommandNode;
      readonly commandName: string;
      readonly parentPath: readonly string[];
      readonly remainingArgv: readonly string[];
    };

export type ArgvScanFn = (
  args: readonly string[],
  onPositional: ScanCallback,
) => ScanResult;

interface MutableCommandNode {
  readonly name: string;
  readonly fullPath: readonly string[];
  readonly parent?: MutableCommandNode;
  readonly children: Map<string, MutableCommandNode>;
  readonly aliasIndex: Map<string, MutableCommandNode>;
  aliases: readonly string[];
  command?: AnyCommandDefinition;
  args: readonly ArgDescriptor[];
  localFlags: readonly FlagDescriptor[];
  builtinFlags: readonly FlagDescriptor[];
}

const EMPTY_DESCRIPTORS: readonly never[] = Object.freeze([]);

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
  aliases: EMPTY_DESCRIPTORS,
  args: EMPTY_DESCRIPTORS,
  localFlags: EMPTY_DESCRIPTORS,
  builtinFlags: EMPTY_DESCRIPTORS,
});

const isVisibleNode = (node: CommandNode): boolean =>
  !node.command?.hidden && (Boolean(node.command) || node.children.size > 0);

export class CommandTreeBuilder implements CommandTree {
  readonly #root: MutableCommandNode = createNode("", []);

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
          throw new InvalidCommandError(
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

  public register(cmd: AnyCommandDefinition): CommandNode {
    const rawName = cmd.name.trim();
    const segments = rawName === "" ? [] : rawName.split(/\s+/);
    const current = this.#ensurePath(segments, true);

    const targetLabel =
      segments.length === 0
        ? "root command"
        : `command "${segments.join(" ")}"`;
    if (current.command) {
      throw new InvalidCommandError(`${targetLabel} already exists`);
    }

    current.command = cmd;

    const rawAliases = cmd.aliases ? toArray(cmd.aliases) : [];
    const normalizedAliases: string[] = [];
    const defaultAliasHost = current.parent ?? this.#root;
    for (const rawAlias of rawAliases) {
      const alias = rawAlias.trim();
      if (alias === "") {
        throw new InvalidCommandError(
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
        throw new InvalidCommandError(`alias "${alias}" already exists`);
      }
      host.aliasIndex.set(leaf, current);
    }
    current.aliases = normalizedAliases;

    return current;
  }

  /**
   * @internal
   */
  public attachCompiled(
    node: CommandNode,
    compiled: {
      readonly args: readonly ArgDescriptor[];
      readonly localFlags: readonly FlagDescriptor[];
      readonly builtinFlags: readonly FlagDescriptor[];
    },
  ): void {
    const target = node as MutableCommandNode;
    target.args = compiled.args;
    target.localFlags = compiled.localFlags;
    target.builtinFlags = compiled.builtinFlags;
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

  public resolveArgv(argv: readonly string[], scan: ArgvScanFn): CommandMatch {
    let current: CommandNode = this.#root;
    const calledTokens: string[] = [];
    const matchedIndices: number[] = [];
    let isContiguousPrefix = true;

    const { stoppedAt } = scan(argv, (token, index) => {
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

      return true;
    });

    let remainingArgv: readonly string[];
    if (matchedIndices.length === 0) {
      remainingArgv = argv;
    } else if (isContiguousPrefix) {
      remainingArgv = argv.slice(matchedIndices.length);
    } else {
      const matchedSet = new Set(matchedIndices);
      remainingArgv = argv.filter((_, index) => !matchedSet.has(index));
    }

    if (
      current.command &&
      (current.command.run || current.children.size === 0)
    ) {
      return {
        kind: "matched",
        node: current,
        command: current.command,
        calledAs: calledTokens.join(" "),
        remainingArgv,
      };
    }

    const stoppedToken = argv[stoppedAt];
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
