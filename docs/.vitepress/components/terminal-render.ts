import type { VNodeChild } from "vue";
import { h } from "vue";

export interface Span {
  readonly text: string;
  readonly cls?: string;
}

export type TerminalBlock =
  | { readonly kind: "line"; readonly spans: readonly Span[] }
  | { readonly kind: "rule" }
  | {
      readonly kind: "log";
      readonly label: Span;
      readonly spans: readonly Span[];
    }
  | {
      readonly kind: "rail";
      readonly rows: readonly (readonly Span[])[];
    }
  | {
      readonly kind: "box";
      readonly label?: Span;
      readonly title?: readonly Span[];
      readonly rows: readonly (readonly Span[])[];
    };

const ESC = String.fromCodePoint(27);

const TOKEN_RE =
  /\{(brand|cyan|tip|green|yellow|red|bold|heading|muted|faint):((?:[^{}]|\{[^{}]*\})*)\}/g;

const LOG_PREFIXES = new Set([
  "debug ",
  " done ",
  "error ",
  " info ",
  " step ",
  "  tip ",
  "usage ",
  " warn ",
]);

export function parseTaggedSpans(line: string): Span[] {
  const spans: Span[] = [];
  let lastIndex = 0;
  for (const match of line.matchAll(TOKEN_RE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      spans.push({ text: line.slice(lastIndex, start) });
    }
    spans.push({ text: match[2], cls: `t-${match[1]}` });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < line.length) {
    spans.push({ text: line.slice(lastIndex) });
  }

  return spans;
}

function ansiClass(
  fg: string | undefined,
  bold: boolean,
  dim: boolean,
  underline: boolean,
): string | undefined {
  if (underline && bold) {
    return "t-heading";
  }
  if (fg === "magenta") {
    return "t-brand";
  }
  if (fg === "red") {
    return "t-red";
  }
  if (fg === "green") {
    return "t-green";
  }
  if (fg === "yellow") {
    return "t-yellow";
  }
  if (fg === "cyan") {
    return bold ? "t-tip" : "t-cyan";
  }
  if (fg === "gray") {
    return dim ? "t-faint" : "t-muted";
  }
  if (dim) {
    return "t-faint";
  }
  if (bold) {
    return "t-bold";
  }

  return undefined;
}

export function parseAnsiSpans(line: string): Span[] {
  const spans: Span[] = [];
  let bold = false;
  let dim = false;
  let underline = false;
  let fg: string | undefined;

  function pushText(text: string): void {
    if (text.length === 0) {
      return;
    }
    const cls = ansiClass(fg, bold, dim, underline);
    const prev = spans.at(-1);
    if (prev && prev.cls === cls) {
      spans[spans.length - 1] = { text: prev.text + text, cls };
    } else {
      spans.push({ text, cls });
    }
  }

  let i = 0;
  while (i < line.length) {
    const esc = line.indexOf(`${ESC}[`, i);
    if (esc === -1) {
      pushText(line.slice(i));

      break;
    }
    pushText(line.slice(i, esc));
    const end = line.indexOf("m", esc + 2);
    if (end === -1) {
      break;
    }
    const rawCodes = line.slice(esc + 2, end);
    const codes =
      rawCodes.length === 0 ? [0] : rawCodes.split(";").map((c) => Number(c));
    for (const code of codes) {
      switch (code) {
        case 0: {
          bold = false;
          dim = false;
          underline = false;
          fg = undefined;

          break;
        }
        case 1: {
          bold = true;

          break;
        }
        case 2: {
          dim = true;

          break;
        }
        case 4: {
          underline = true;

          break;
        }
        case 22: {
          bold = false;
          dim = false;

          break;
        }
        case 24: {
          underline = false;

          break;
        }
        case 31: {
          fg = "red";

          break;
        }
        case 32: {
          fg = "green";

          break;
        }
        case 33: {
          fg = "yellow";

          break;
        }
        case 35: {
          fg = "magenta";

          break;
        }
        case 36: {
          fg = "cyan";

          break;
        }
        case 39: {
          fg = undefined;

          break;
        }
        case 90: {
          fg = "gray";

          break;
        }
        default: {
          break;
        }
      }
    }
    i = end + 1;
  }

  return spans;
}

const plainOf = (spans: readonly Span[]): string =>
  spans.map((s) => s.text).join("");

function sliceSpans(
  spans: readonly Span[],
  start: number,
  end = Infinity,
): Span[] {
  const out: Span[] = [];
  let offset = 0;
  for (const span of spans) {
    const next = offset + span.text.length;
    if (next > start && offset < end) {
      const from = Math.max(0, start - offset);
      const to = Math.min(span.text.length, end - offset);
      if (to > from) {
        out.push({ text: span.text.slice(from, to), cls: span.cls });
      }
    }
    offset = next;
  }

  return out;
}

function trimSpans(spans: readonly Span[]): Span[] {
  const text = plainOf(spans);
  const leading = text.length - text.trimStart().length;
  const trailing = text.trimEnd().length;

  return leading >= trailing ? [] : sliceSpans(spans, leading, trailing);
}

function blocksFromParsed(
  parsed: readonly { readonly spans: readonly Span[]; readonly text: string }[],
): TerminalBlock[] {
  const blocks: TerminalBlock[] = [];
  let i = 0;

  while (i < parsed.length) {
    const { spans, text } = parsed[i];
    const trimmed = text.trim();

    if (trimmed.length >= 16 && [...trimmed].every((ch) => ch === "─")) {
      blocks.push({ kind: "rule" });
      i++;

      continue;
    }

    const boxStart = text.indexOf("╭─");
    if (boxStart !== -1 && text.trimEnd().endsWith("╮")) {
      const labelSpans = trimSpans(sliceSpans(spans, 0, boxStart));
      const label = labelSpans[0];

      const afterCorner = text.slice(boxStart + 2);
      const trailMatch = /─+╮\s*$/.exec(afterCorner);
      const titleEnd = trailMatch
        ? boxStart + 2 + trailMatch.index
        : text.length - 1;
      const title = trimSpans(sliceSpans(spans, boxStart + 2, titleEnd));

      const rows: Span[][] = [];
      i++;
      while (i < parsed.length) {
        const row = parsed[i];
        const rowTrim = row.text.trim();
        if (rowTrim.startsWith("╰") && rowTrim.endsWith("╯")) {
          i++;

          break;
        }
        const leftBar = row.text.indexOf("│");
        const rightBar = row.text.lastIndexOf("│");
        if (leftBar !== -1 && rightBar > leftBar) {
          rows.push(trimSpans(sliceSpans(row.spans, leftBar + 1, rightBar)));
          i++;
        } else {
          break;
        }
      }

      blocks.push({
        kind: "box",
        label,
        title: title.length > 0 ? title : undefined,
        rows,
      });

      continue;
    }

    if (text.startsWith("      │")) {
      const rows: Span[][] = [];
      while (i < parsed.length && parsed[i].text.startsWith("      │")) {
        const cur = parsed[i];
        const cut = cur.text.startsWith("      │ ") ? 8 : 7;
        rows.push(sliceSpans(cur.spans, cut));
        i++;
      }
      blocks.push({ kind: "rail", rows });

      continue;
    }

    if (text.length >= 6 && LOG_PREFIXES.has(text.slice(0, 6))) {
      const labelPart = trimSpans(sliceSpans(spans, 0, 5));
      const label = labelPart[0] ?? { text: text.slice(0, 5).trim() };
      blocks.push({
        kind: "log",
        label,
        spans: sliceSpans(spans, 6),
      });
      i++;

      continue;
    }

    blocks.push({ kind: "line", spans });
    i++;
  }

  return blocks;
}

export const parseTaggedLines = (lines: readonly string[]): TerminalBlock[] =>
  blocksFromParsed(
    lines.map((line) => {
      const spans = parseTaggedSpans(line);

      return { spans, text: plainOf(spans) };
    }),
  );

export const parseAnsiLines = (lines: readonly string[]): TerminalBlock[] =>
  blocksFromParsed(
    lines.map((line) => {
      const spans = parseAnsiSpans(line);

      return { spans, text: plainOf(spans) };
    }),
  );

const renderSpans = (spans: readonly Span[], keyPrefix: string): VNodeChild[] =>
  spans.map((seg, idx) =>
    seg.cls
      ? h("span", { key: `${keyPrefix}-${idx}`, class: seg.cls }, seg.text)
      : seg.text,
  );

export const renderTerminalBlocks = (
  blocks: readonly TerminalBlock[],
): VNodeChild =>
  h(
    "div",
    { class: "term-blocks" },
    blocks.map((block, bi) => {
      switch (block.kind) {
        case "rule": {
          return h("div", {
            "key": `b-${bi}`,
            "class": "term-rule",
            "aria-hidden": "true",
          });
        }

        case "log": {
          return h("div", { key: `b-${bi}`, class: "term-log" }, [
            h(
              "span",
              { class: ["term-gutter", block.label.cls] },
              block.label.text,
            ),
            h(
              "span",
              { class: "term-body" },
              renderSpans(block.spans, `l-${bi}`),
            ),
          ]);
        }

        case "rail": {
          return h("div", { key: `b-${bi}`, class: "term-rail-row" }, [
            h("span", { "class": "term-gutter", "aria-hidden": "true" }),
            h(
              "div",
              { class: "term-rail" },
              block.rows.map((row, ri) =>
                h(
                  "div",
                  { key: `r-${bi}-${ri}`, class: "term-rail-line" },
                  renderSpans(row, `r-${bi}-${ri}`),
                ),
              ),
            ),
          ]);
        }

        case "box": {
          return h("div", { key: `b-${bi}`, class: "term-box-row" }, [
            h(
              "span",
              { class: ["term-gutter", block.label?.cls] },
              block.label?.text ?? "",
            ),
            h("fieldset", { class: "term-box" }, [
              block.title && block.title.length > 0
                ? h(
                    "legend",
                    { class: "term-box-title" },
                    renderSpans(block.title, `bt-${bi}`),
                  )
                : null,
              ...block.rows.map((row, ri) =>
                h(
                  "div",
                  { key: `bx-${bi}-${ri}`, class: "term-box-line" },
                  renderSpans(row, `bx-${bi}-${ri}`),
                ),
              ),
            ]),
          ]);
        }

        default: {
          return h(
            "div",
            { key: `b-${bi}`, class: "term-line" },
            block.spans.length > 0
              ? renderSpans(block.spans, `ln-${bi}`)
              : "\u200B",
          );
        }
      }
    }),
  );
