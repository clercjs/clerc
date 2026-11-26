import { detectColor, detectUnicode } from "@clerc/theme";

export interface Terminal {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly argv: readonly string[];
  readonly cwd: () => string;
  readonly isTTY: boolean;
  readonly isInputTTY: boolean;
  readonly readStdin: () => Promise<string>;
  readonly color: boolean;
  readonly unicode: boolean;
  readonly columns: number;
}

export interface MemoryTerminal extends Terminal {
  readonly stdoutLines: string[];
  readonly stderrLines: string[];
  readonly stdoutText: () => string;
  readonly stderrText: () => string;
  readonly clear: () => void;
}

export interface MemoryTerminalOptions extends Partial<
  Omit<Terminal, "stdout" | "stderr" | "cwd">
> {
  readonly cwd?: string;
  readonly stdin?: string;
}

const defaultPlatformArgv = (): readonly string[] =>
  process.argv.slice(
    process.versions.electron &&
      !(process as { readonly defaultApp?: boolean }).defaultApp
      ? 1
      : 2,
  );

async function readProcessStdin(): Promise<string> {
  if (process.stdin.readableEnded) {
    return "";
  }
  process.stdin.setEncoding("utf8");
  let content = "";
  for await (const chunk of process.stdin) {
    content += String(chunk);
  }

  return content;
}

export function createTerminal(overrides: Partial<Terminal> = {}): Terminal {
  const env = overrides.env ?? process.env;
  const isTTY = overrides.isTTY ?? Boolean(process.stdout.isTTY);
  const isInputTTY = overrides.isInputTTY ?? Boolean(process.stdin.isTTY);
  const color = overrides.color ?? detectColor(env, isTTY);
  const unicode = overrides.unicode ?? detectUnicode(env);
  const columns = overrides.columns ?? process.stdout.columns ?? 80;

  return {
    stdout: overrides.stdout ?? ((text) => process.stdout.write(`${text}\n`)),
    stderr: overrides.stderr ?? ((text) => process.stderr.write(`${text}\n`)),
    env,
    argv: overrides.argv ?? defaultPlatformArgv(),
    cwd: overrides.cwd ?? (() => process.cwd()),
    isTTY,
    isInputTTY,
    readStdin: overrides.readStdin ?? readProcessStdin,
    color,
    unicode,
    columns,
  };
}

export function createMemoryTerminal(
  options: MemoryTerminalOptions = {},
): MemoryTerminal {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const cwdValue = options.cwd ?? "/";
  const isTTY = options.isTTY ?? true;
  const isInputTTY =
    options.isInputTTY ?? (options.stdin === undefined ? isTTY : false);
  const stdinValue = options.stdin ?? "";

  return {
    stdout: (text) => {
      stdoutLines.push(text);
    },
    stderr: (text) => {
      stderrLines.push(text);
    },
    env: options.env ?? {},
    argv: options.argv ?? [],
    cwd: () => cwdValue,
    isTTY,
    isInputTTY,
    readStdin: options.readStdin ?? (async () => stdinValue),
    color: options.color ?? false,
    unicode: options.unicode ?? true,
    columns: options.columns ?? 80,
    stdoutLines,
    stderrLines,
    stdoutText: () => stdoutLines.join("\n"),
    stderrText: () => stderrLines.join("\n"),
    clear: () => {
      stdoutLines.length = 0;
      stderrLines.length = 0;
    },
  };
}
