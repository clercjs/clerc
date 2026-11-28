import { stripAnsi } from "./ansi.ts";

export interface BoxOptions {
  readonly formatBorder?: (char: string) => string;
  readonly output?: { readonly write: (chunk: string) => void };
}

export function box(message = "", title = "", options: BoxOptions = {}): void {
  const fmt = options.formatBorder ?? ((c: string) => c);
  const bodyLines = String(message).split("\n");
  const titleVis = title ? stripAnsi(title).length : 0;
  const maxBody = bodyLines.reduce(
    (max, line) => Math.max(max, stripAnsi(line).length),
    0,
  );
  const inner = Math.max(maxBody + 4, titleVis + 4);
  const topFill = Math.max(1, inner - 1 - titleVis);
  const top = fmt("╭─") + title + fmt(`${"─".repeat(topFill)}╮`);
  const rows = bodyLines.map((line) => {
    const pad = Math.max(0, inner - 2 - stripAnsi(line).length);

    return `${fmt("│")}  ${line}${" ".repeat(pad)}${fmt("│")}`;
  });
  const bottom = fmt(`╰${"─".repeat(inner)}╯`);
  options.output?.write(`${[top, ...rows, bottom].join("\n")}\n`);
}

export const spinner = () => ({
  start() {},
  message() {},
  stop() {},
  error() {},
  cancel() {},
  clear() {},
  isCancelled: false,
});
