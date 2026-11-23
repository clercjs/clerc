import stringWidth from "fast-string-width";

export type TwoColumnRow = readonly [left: string, right: string];

export interface TwoColumnOptions {
  readonly indent?: number;
  readonly gap?: number;
  readonly maxWidth?: number;
  readonly maxLeftWidth?: number;
  readonly colWidth?: number;
}

const MAX_READABLE_WIDTH = 120;

export function wrapLine(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0 || stringWidth(text) <= maxWidth) {
    return [text];
  }

  const lines: string[] = [];
  let current = "";
  let currentWidth = 0;

  for (const token of text.split(/(\s+)/)) {
    if (token === "") {
      continue;
    }
    const isWhitespace = /^\s+$/.test(token);
    if (currentWidth === 0 && isWhitespace) {
      continue;
    }

    const tokenWidth = stringWidth(token);
    if (currentWidth > 0 && currentWidth + tokenWidth > maxWidth) {
      lines.push(current.trimEnd());
      current = isWhitespace ? "" : token;
      currentWidth = isWhitespace ? 0 : tokenWidth;
    } else {
      current += token;
      currentWidth += tokenWidth;
    }
  }

  if (current.trimEnd().length > 0 || lines.length === 0) {
    lines.push(current.trimEnd());
  }

  return lines;
}

export function measureColumnWidth(
  rows: readonly TwoColumnRow[],
  options: Pick<TwoColumnOptions, "maxWidth" | "maxLeftWidth"> = {},
): number {
  const maxWidth = Math.min(options.maxWidth ?? 100, MAX_READABLE_WIDTH);
  const maxLeftCap =
    options.maxLeftWidth ??
    Math.min(34, Math.max(24, Math.floor(maxWidth * 0.38)));

  let maxLeft = 0;
  for (const [left] of rows) {
    const w = stringWidth(left);
    if (w > maxLeft) {
      maxLeft = w;
    }
  }

  return Math.min(maxLeft, maxLeftCap);
}

export function formatTwoColumn(
  rows: readonly TwoColumnRow[],
  options: TwoColumnOptions = {},
): string[] {
  if (rows.length === 0) {
    return [];
  }

  const indentSize = options.indent ?? 2;
  const indent = " ".repeat(indentSize);
  const gap = options.gap ?? 3;
  const maxWidth = Math.min(options.maxWidth ?? 100, MAX_READABLE_WIDTH);
  const colWidth = options.colWidth ?? measureColumnWidth(rows, options);
  const prefixWidth = indentSize + colWidth + gap;
  const rightBudget = Math.max(20, maxWidth - prefixWidth);
  const hangingIndent = " ".repeat(prefixWidth);

  const output: string[] = [];

  for (const [left, right] of rows) {
    const leftW = stringWidth(left);

    if (!right) {
      output.push(`${indent}${left}`);

      continue;
    }

    const wrappedRight = right
      .split("\n")
      .flatMap((paragraph) => wrapLine(paragraph, rightBudget));

    const overflows = leftW > colWidth;
    if (overflows) {
      output.push(`${indent}${left}`);
    } else {
      const padding = " ".repeat(colWidth - leftW + gap);
      output.push(`${indent}${left}${padding}${wrappedRight[0]}`);
    }

    for (let j = overflows ? 0 : 1; j < wrappedRight.length; j++) {
      output.push(`${hangingIndent}${wrappedRight[j]}`);
    }
  }

  return output;
}
