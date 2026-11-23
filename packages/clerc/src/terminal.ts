import { detectColor, detectUnicode } from "@clerc/theme";

export interface Terminal {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly argv: readonly string[];
  readonly cwd: () => string;
  readonly isTTY: boolean;
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

export interface MemoryTerminalOptions {
  env?: Readonly<Record<string, string | undefined>>;
  argv?: readonly string[];
  cwd?: string;
  isTTY?: boolean;
  color?: boolean;
  unicode?: boolean;
  columns?: number;
}

export const defaultPlatformArgv = (): readonly string[] =>
  process.argv.slice(
    process.versions.electron &&
      !(process as { readonly defaultApp?: boolean }).defaultApp
      ? 1
      : 2,
  );

export function createTerminal(overrides: Partial<Terminal> = {}): Terminal {
  const env = overrides.env ?? process.env;
  const isTTY = overrides.isTTY ?? Boolean(process.stdout.isTTY);
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
    isTTY: options.isTTY ?? true,
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
