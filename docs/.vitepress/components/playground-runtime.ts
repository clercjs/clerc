import type { Clerc } from "../../../packages/clerc/src/cli.ts";
import { createMemoryTerminal } from "../../../packages/clerc/src/terminal.ts";
import type {
  CliModel,
  CommandNode,
} from "../../../packages/clerc/src/types.ts";
import { kebabCase } from "../../../packages/clerc/src/utils.ts";
import type { TerminalBlock } from "./terminal-render.ts";
import { parseAnsiLines } from "./terminal-render.ts";

export { clerc, plugin } from "../../../packages/clerc/src/cli.ts";
export { ClercError } from "../../../packages/clerc/src/errors.ts";
export { Types } from "../../../packages/clerc/src/schema.ts";
export type { TypeFunction } from "../../../packages/clerc/src/types.ts";

Error.isError ??= (val: unknown): val is Error => val instanceof Error;

export interface PlaygroundScenario {
  readonly createCli: () => Clerc<any, any>;
  readonly source: string;
  readonly presets: readonly {
    readonly cmd: string;
    readonly label?: string;
  }[];
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export function tokenizeArgv(raw: string, binName: string): string[] {
  const prefixRe = new RegExp(`^(?:\\$\\s*)?(?:${binName}\\b\\s*)?`);
  const cleaned = raw.trim().replace(prefixRe, "");
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;

  for (const ch of cleaned) {
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

export async function runScenarioCli(
  scenario: PlaygroundScenario,
  rawInput: string,
): Promise<{
  readonly exitCode: number;
  readonly blocks: readonly TerminalBlock[];
}> {
  const cli = scenario.createCli();
  const binName = cli.buildModel().meta.name;
  const argv = tokenizeArgv(rawInput, binName);
  const terminal = createMemoryTerminal({
    color: true,
    unicode: true,
    columns: 68,
    env: scenario.env,
  });

  const result = await cli.run(argv, { terminal });
  const rawLines = [...terminal.stdoutLines, ...terminal.stderrLines].flatMap(
    (chunk) => chunk.split("\n"),
  );

  return {
    exitCode: result.exitCode,
    blocks:
      rawLines.length > 0
        ? parseAnsiLines(rawLines)
        : [
            {
              kind: "line",
              spans: [{ text: "(no output)", cls: "t-faint" }],
            },
          ],
  };
}

export interface CompletionEntry {
  readonly value: string;
  readonly insert: string;
  readonly description?: string;
}

export interface CompletionQueryResult {
  readonly prefix: string;
  readonly items: readonly CompletionEntry[];
}

export function getModelCompletions(
  model: CliModel,
  raw: string,
): CompletionQueryResult {
  const trailingSpace = raw.length === 0 || /\s$/.test(raw);
  const trimmed = raw.trim();
  const rawParts = trimmed.length === 0 ? [] : trimmed.split(/\s+/);
  const prior = trailingSpace ? rawParts : rawParts.slice(0, -1);
  const last = trailingSpace ? "" : (rawParts.at(-1) ?? "");

  let node: CommandNode = model.tree.root;
  let posCount = 0;

  if (prior[0] === "help") {
    for (const word of prior.slice(1)) {
      const next = node.children.get(word) ?? node.aliasIndex.get(word);
      if (!next) {
        break;
      }
      node = next;
    }
    const items: CompletionEntry[] = model.tree
      .listVisibleChildren(node)
      .filter((c) => c.name !== "help" && c.name.startsWith(last))
      .map((c) => ({
        value: c.name,
        insert: `${c.name} `,
        description: c.command?.description,
      }));

    return { prefix: last, items };
  }

  const usedFlags = new Set<string>();
  const positionalWords: string[] = [];
  let expectFlagValueFor: string | null = null;

  function findFlag(targetNode: CommandNode, token: string) {
    const allFlags = [
      ...targetNode.localFlags,
      ...model.globalFlags,
      ...targetNode.builtinFlags,
    ];

    return allFlags.find((f) => {
      const kebab = kebabCase(f.name);

      return (
        token === `--${kebab}` ||
        token === `--no-${kebab}` ||
        (f.short && token === `-${f.short}`)
      );
    });
  }

  for (const word of prior) {
    if (word === "--") {
      expectFlagValueFor = null;

      break;
    }
    if (expectFlagValueFor) {
      expectFlagValueFor = null;

      continue;
    }
    if (word.startsWith("-")) {
      const eqIdx = word.indexOf("=");
      const flagTok = eqIdx === -1 ? word : word.slice(0, eqIdx);
      const matched = findFlag(node, flagTok);
      if (matched) {
        usedFlags.add(matched.name);
        const takesVal =
          eqIdx === -1 &&
          (matched.kind === "single" || matched.kind === "array") &&
          matched.implicitValue === undefined;
        if (takesVal) {
          expectFlagValueFor = flagTok;
        }
      }

      continue;
    }
    const child = node.children.get(word) ?? node.aliasIndex.get(word);
    if (child && posCount === 0) {
      node = child;
    } else {
      positionalWords.push(word);
      posCount += 1;
    }
  }

  let effectiveNode = node;
  if (
    node === model.tree.root &&
    model.defaultCommand &&
    (posCount > 0 || last.startsWith("-"))
  ) {
    effectiveNode = model.tree.findNode(model.defaultCommand) ?? node;
  }

  const items: CompletionEntry[] = [];
  const seen = new Set<string>();
  function pushItem(entry: CompletionEntry) {
    if (seen.has(entry.value)) {
      return;
    }
    if (last.length > 0 && !entry.value.startsWith(last)) {
      return;
    }
    seen.add(entry.value);
    items.push(entry);
  }

  // 1. Completing value for a preceding value-taking flag (e.g. "-r <TAB>")
  if (expectFlagValueFor && !last.startsWith("-")) {
    const matchedFlag = findFlag(effectiveNode, expectFlagValueFor);
    if (matchedFlag) {
      const schema = (
        matchedFlag as unknown as {
          readonly toJsonSchema?: () => { readonly enum?: readonly unknown[] };
        }
      ).toJsonSchema?.();
      if (Array.isArray(schema?.enum)) {
        for (const val of schema.enum) {
          const text = String(val);
          pushItem({
            value: text,
            insert: `${text} `,
            description: matchedFlag.description,
          });
        }
      }
      if (typeof matchedFlag.complete === "function") {
        const res = matchedFlag.complete({
          word: last,
          words: rawParts,
          wordIndex: trailingSpace ? rawParts.length : rawParts.length - 1,
          command: effectiveNode,
          args: {},
          flags: {},
          model,
        } as never);
        if (Array.isArray(res)) {
          for (const item of res) {
            const val = typeof item === "string" ? item : item.value;
            const desc =
              typeof item === "string"
                ? matchedFlag.description
                : item.description;
            pushItem({ value: val, insert: `${val} `, description: desc });
          }
        }
      }
    }

    return { prefix: last, items };
  }

  // 2. Subcommands & positional argument completions (when not typing a flag)
  if (!last.startsWith("-")) {
    if (posCount === 0 && node.children.size > 0) {
      for (const child of model.tree.listVisibleChildren(node)) {
        pushItem({
          value: child.name,
          insert: `${child.name} `,
          description: child.command?.description,
        });
      }
    }

    const argIndex =
      posCount < effectiveNode.args.length
        ? posCount
        : effectiveNode.args.at(-1)?.isVariadic
          ? effectiveNode.args.length - 1
          : -1;
    const argDesc = argIndex >= 0 ? effectiveNode.args[argIndex] : undefined;

    if (argDesc) {
      const schema = (
        argDesc as unknown as {
          readonly toJsonSchema?: () => { readonly enum?: readonly unknown[] };
        }
      ).toJsonSchema?.();
      if (Array.isArray(schema?.enum)) {
        for (const val of schema.enum) {
          const text = String(val);
          pushItem({
            value: text,
            insert: `${text} `,
            description: argDesc.description ?? `<${argDesc.name}>`,
          });
        }
      }
      if (typeof argDesc.complete === "function") {
        const argsMap: Record<string, string> = {};
        for (const [idx, a] of effectiveNode.args.entries()) {
          if (positionalWords[idx]) {
            argsMap[a.name] = positionalWords[idx];
          }
        }
        const res = argDesc.complete({
          word: last,
          words: rawParts,
          wordIndex: trailingSpace ? rawParts.length : rawParts.length - 1,
          command: effectiveNode,
          args: argsMap,
          flags: {},
          model,
        } as never);
        if (Array.isArray(res)) {
          for (const item of res) {
            const val = typeof item === "string" ? item : item.value;
            const desc =
              typeof item === "string" ? argDesc.description : item.description;
            pushItem({ value: val, insert: `${val} `, description: desc });
          }
        }
      }
    }
  }

  // 3. Flags (always available when starting with "-" or when pressing Tab on empty/trailing space)
  if (last.startsWith("-") || last.length === 0) {
    const allFlags = [
      ...effectiveNode.localFlags,
      ...model.globalFlags,
      ...effectiveNode.builtinFlags,
    ];
    for (const f of allFlags) {
      if (f.hidden) {
        continue;
      }
      if (f.kind !== "array" && f.kind !== "counter" && usedFlags.has(f.name)) {
        continue;
      }
      const kebab = kebabCase(f.name);
      const needsVal =
        (f.kind === "single" || f.kind === "array") &&
        f.implicitValue === undefined;
      pushItem({
        value: `--${kebab}`,
        insert: `--${kebab}${needsVal ? " " : " "}`,
        description: f.description,
      });
      if (f.negatable && f.default === true) {
        pushItem({
          value: `--no-${kebab}`,
          insert: `--no-${kebab} `,
          description: f.description ? `Disable: ${f.description}` : undefined,
        });
      }
    }
  }

  return { prefix: last, items };
}

export function computeModelGhostSuffix(model: CliModel, raw: string): string {
  if (raw.length === 0 || /\s$/.test(raw)) {
    return "";
  }
  const { prefix, items } = getModelCompletions(model, raw);
  const hit = items.find((item) => item.value !== prefix);

  return hit ? hit.insert.slice(prefix.length) : "";
}
