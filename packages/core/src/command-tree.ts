import type { FlagsDefinition as ParserFlagsDefinition } from "@clerc/parser";
import { DOUBLE_DASH, createParser } from "@clerc/parser";

import { InvalidCommandError } from "./errors";
import type {
  AnyCommandDefinition,
  CommandNode,
  ReadonlyCommandTree,
} from "./types";
import { toArray } from "./utils";

export interface ArgvResolution {
  readonly node: CommandNode;
  readonly command?: AnyCommandDefinition;
  readonly calledAs?: string;
  readonly matchedPath: readonly string[];
  readonly remainingArgv: readonly string[];
  readonly leadingPositional?: string;
}

const createNode = (
  name: string,
  fullPath: readonly string[],
  parent?: CommandNode,
): CommandNode => ({
  name,
  fullPath,
  parent,
  children: new Map(),
  aliasIndex: new Map(),
});

const isVisibleNode = (node: CommandNode): boolean =>
  !node.command?.hidden && (Boolean(node.command) || node.children.size > 0);

export class CommandTree implements ReadonlyCommandTree {
  public readonly root: CommandNode = createNode("", []);

  #ensurePath(
    segments: readonly string[],
    checkAliasConflict: boolean,
  ): CommandNode {
    let current = this.root;
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

  public register(
    cmd: AnyCommandDefinition,
    parentPath: readonly string[] = [],
  ): CommandNode {
    const rawName = cmd.name.trim();
    const segments = rawName === "" ? [] : rawName.split(/\s+/);
    const fullSegments = [...parentPath, ...segments];

    const current = this.#ensurePath(fullSegments, true);

    if (current.command) {
      const label =
        fullSegments.length === 0 ? "(root)" : fullSegments.join(" ");

      throw new InvalidCommandError(`command "${label}" already exists`);
    }

    current.command = cmd;

    const aliases = cmd.aliases ? toArray(cmd.aliases) : [];
    const defaultAliasHost = current.parent ?? this.root;
    for (const rawAlias of aliases) {
      const alias = rawAlias.trim();
      if (alias === "") {
        if (this.root.command && this.root.command !== cmd) {
          throw new InvalidCommandError(
            "root command alias conflicts with existing root command",
          );
        }
        this.root.aliasIndex.set("", current);

        continue;
      }

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

    for (const sub of cmd.subcommands ?? []) {
      this.register(sub, fullSegments);
    }

    return current;
  }

  public findNode(path: readonly string[]): CommandNode | undefined {
    let current: CommandNode = this.root;
    for (const seg of path) {
      const next = current.children.get(seg) ?? current.aliasIndex.get(seg);
      if (!next) {
        return undefined;
      }
      current = next;
    }

    return current;
  }

  public listChildren(node: CommandNode = this.root): readonly CommandNode[] {
    return [...node.children.values()];
  }

  public listVisibleChildren(
    node: CommandNode = this.root,
  ): readonly CommandNode[] {
    return [...node.children.values()].filter(isVisibleNode);
  }

  public walkCommands(): readonly CommandNode[] {
    const result: CommandNode[] = [];
    function visit(node: CommandNode): void {
      if (node.command) {
        result.push(node);
      }
      for (const child of node.children.values()) {
        visit(child);
      }
    }
    visit(this.root);

    return result;
  }

  /**
   * Resolves the longest matching command in the tree by delegating leading
   * global flag scanning to `@clerc/parser`.
   */
  public resolveArgv(
    argv: readonly string[],
    globalFlags: ParserFlagsDefinition,
  ): ArgvResolution {
    let current: CommandNode = this.root;
    const calledTokens: string[] = [];
    const matchedIndices = new Set<number>();

    const { stoppedAt } = createParser({ flags: globalFlags }).scan(
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

        return true;
      },
    );

    const remainingArgv = argv.filter((_, index) => !matchedIndices.has(index));
    const stoppedToken = argv[stoppedAt];
    const leadingPositional =
      stoppedToken &&
      stoppedToken !== DOUBLE_DASH &&
      !stoppedToken.startsWith("-")
        ? stoppedToken
        : undefined;

    if (!current.command && calledTokens.length === 0) {
      const rootAliasTarget = this.root.aliasIndex.get("");
      if (rootAliasTarget?.command) {
        return {
          node: rootAliasTarget,
          command: rootAliasTarget.command,
          calledAs: "",
          matchedPath: rootAliasTarget.fullPath,
          remainingArgv,
          leadingPositional,
        };
      }
    }

    return {
      node: current,
      command: current.command,
      calledAs:
        current.command || calledTokens.length > 0
          ? calledTokens.join(" ")
          : undefined,
      matchedPath: current.fullPath,
      remainingArgv,
      leadingPositional,
    };
  }
}
