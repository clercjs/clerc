import stringWidth from "fast-string-width";

export interface TwoColumnOptions {
  readonly indent?: number;
  readonly gap?: number;
  readonly maxWidth?: number;
  readonly maxLeftWidth?: number;
}

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

export function formatTwoColumn(
  rows: readonly (readonly [left: string, right: string])[],
  options: TwoColumnOptions = {},
): string[] {
  if (rows.length === 0) {
    return [];
  }

  const indentSize = options.indent ?? 2;
  const indent = " ".repeat(indentSize);
  const gap = options.gap ?? 2;
  const maxWidth = Math.min(options.maxWidth ?? 100, 100);
  const maxLeftCap =
    options.maxLeftWidth ?? Math.max(24, Math.floor(maxWidth * 0.42));

  let maxLeft = 0;
  const leftWidths = rows.map(([left]) => {
    const w = stringWidth(left);
    if (w > maxLeft) {
      maxLeft = w;
    }

    return w;
  });

  const colWidth = Math.min(maxLeft, maxLeftCap);
  const prefixWidth = indentSize + colWidth + gap;
  const rightBudget = Math.max(20, maxWidth - prefixWidth);
  const hangingIndent = " ".repeat(prefixWidth);

  const output: string[] = [];

  for (const [i, [left, right]] of rows.entries()) {
    const leftW = leftWidths[i];

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
