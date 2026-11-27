import type { ArgDescriptor } from "./args";
import type { Command } from "./command";
import { InvalidSchemaError } from "./errors";
import type { FlagConstraint, FlagDescriptor } from "./flags";
import type { ScanCallback, ScanResult } from "./parser";
import { DOUBLE_DASH } from "./parser";
import type { CliModel } from "./types";
import type { Mutable } from "./utils";
import { toArray } from "./utils";

export interface CommandNode {
  readonly name: string;
  readonly fullPath: readonly string[];
  readonly parent?: CommandNode;
  readonly children: ReadonlyMap<string, CommandNode>;
  readonly aliasIndex: ReadonlyMap<string, CommandNode>;
  readonly aliases: readonly string[];
  readonly command?: Command;
  readonly defaultChild?: CommandNode;
  readonly args: readonly ArgDescriptor[];
  readonly localFlags: readonly FlagDescriptor[];
  readonly builtinFlags: readonly FlagDescriptor[];
  readonly constraints: readonly FlagConstraint[];
  readonly checkNotes: readonly string[];
}

export interface CommandTree {
  readonly root: CommandNode;
  findNode: (path: readonly string[]) => CommandNode | undefined;
  listChildren: (node?: CommandNode) => readonly CommandNode[];
  listVisibleChildren: (node?: CommandNode) => readonly CommandNode[];
  walkCommands: () => readonly (CommandNode & {
    readonly command: Command;
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
  const localNames = new Set(node.localFlags.map((f) => f.name));

  return [
    ...(node.command?.builtin
      ? []
      : model.globalFlags.filter((f) => !localNames.has(f.name))),
    ...node.localFlags,
    ...(options.includeBuiltins ? node.builtinFlags : []),
  ];
}

export type CommandMatch = {
  readonly node: CommandNode;
  readonly remainingArgv: readonly string[];
} & (
  | {
      readonly kind: "matched";
      readonly command: Command;
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
  aliases: [],
  args: [],
  localFlags: [],
  builtinFlags: [],
  constraints: [],
  checkNotes: [],
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

  public register(cmd: Command): CommandNode {
    const rawName = cmd.name.trim();
    const segments = rawName ? rawName.split(/\s+/) : [];
    const current = this.#ensurePath(segments, true);
    const targetLabel =
      segments.length === 0
        ? "root command"
        : `command "${segments.join(" ")}"`;

    if (current.command) {
      throw new InvalidSchemaError(`${targetLabel} already exists`);
    }
    current.command = cmd;

    if (cmd.aliases) {
      const normalizedAliases: string[] = [];
      const defaultHost = current.parent ?? this.#root;
      for (const rawAlias of toArray(cmd.aliases)) {
        const alias = rawAlias.trim();
        if (!alias) {
          throw new InvalidSchemaError(
            `${targetLabel} cannot have an empty alias`,
          );
        }
        normalizedAliases.push(alias);

        const parts = alias.split(/\s+/);
        const leaf = parts.at(-1)!;
        const host =
          parts.length > 1
            ? this.#ensurePath(parts.slice(0, -1), false)
            : defaultHost;

        if (host.children.has(leaf) || host.aliasIndex.has(leaf)) {
          throw new InvalidSchemaError(`alias "${alias}" already exists`);
        }
        host.aliasIndex.set(leaf, current);
      }
      current.aliases = normalizedAliases;
    }

    return current;
  }

  public setDefaultChild(parent: CommandNode, child: CommandNode): void {
    (parent as MutableCommandNode).defaultChild = child as MutableCommandNode;
  }

  public attachCompiled(
    node: CommandNode,
    compiled: Pick<
      CommandNode,
      "args" | "localFlags" | "builtinFlags" | "constraints" | "checkNotes"
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
    readonly command: Command;
  })[] {
    return this.walkNodes().filter(
      (node): node is CommandNode & { readonly command: Command } =>
        node.command !== undefined,
    );
  }

  public resolveArgv(
    argv: readonly string[],
    getScan: (node: CommandNode) => ArgvScanFn,
  ): CommandMatch {
    let current: CommandNode = this.#root;
    const calledTokens: string[] = [];
    const matchedIndices = new Set<number>();
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
          current = nextNode;
          calledTokens.push(token);
          matchedIndices.add(index);
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

    const remainingArgv =
      matchedIndices.size === 0
        ? argv
        : argv.filter((_, index) => !matchedIndices.has(index));

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
    if (
      stoppedToken &&
      stoppedToken !== DOUBLE_DASH &&
      !stoppedToken.startsWith("-")
    ) {
      const parentPath = current.fullPath;

      return {
        kind: "unknown",
        node: current,
        commandName:
          parentPath.length > 0
            ? [...parentPath, stoppedToken].join(" ")
            : stoppedToken,
        parentPath,
        remainingArgv,
      };
    }

    return {
      kind: current.fullPath.length > 0 ? "namespace" : "empty",
      node: current,
      remainingArgv,
    };
  }
}
