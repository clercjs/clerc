import { styleText } from "node:util";

export type StyleFormat = Parameters<typeof styleText>[0];

export interface ThemeStyleMap {
  readonly brand: StyleFormat;
  readonly heading: StyleFormat;
  readonly command: StyleFormat;
  readonly flag: StyleFormat;
  readonly placeholder: StyleFormat;
  readonly muted: StyleFormat;
  readonly error: StyleFormat;
  readonly warn: StyleFormat;
  readonly success: StyleFormat;
  readonly info: StyleFormat;
  readonly accent: StyleFormat;
  readonly code: StyleFormat;
  readonly bold: StyleFormat;
  readonly dim: StyleFormat;
}

export type ThemeToken = keyof ThemeStyleMap;

export type Theme = {
  readonly enabled: boolean;
} & Readonly<Record<ThemeToken, (text: string) => string>>;

export const defaultThemeStyles: ThemeStyleMap = {
  brand: ["bold", "magenta"],
  heading: ["bold", "underline"],
  command: "bold",
  flag: "blue",
  placeholder: "gray",
  muted: "gray",
  error: ["bold", "red"],
  warn: "magenta",
  success: "green",
  info: "blue",
  accent: "magenta",
  code: "bold",
  bold: "bold",
  dim: "dim",
};

export const monoThemeStyles: ThemeStyleMap = {
  brand: "bold",
  heading: "bold",
  command: "bold",
  flag: [],
  placeholder: "dim",
  muted: "dim",
  error: "bold",
  warn: "bold",
  success: "bold",
  info: "bold",
  accent: "bold",
  code: "bold",
  bold: "bold",
  dim: "dim",
};

const THEME_TOKENS = Object.keys(defaultThemeStyles) as readonly ThemeToken[];
const identity = (text: string): string => text;

function buildTheme(enabled: boolean, styles?: ThemeStyleMap): Theme {
  const theme: Record<string, unknown> = { enabled };
  for (const token of THEME_TOKENS) {
    const format = styles?.[token];
    const hasFormat =
      format !== undefined && (!Array.isArray(format) || format.length > 0);
    theme[token] =
      enabled && hasFormat
        ? (text: string) => styleText(format, text, { validateStream: false })
        : identity;
  }

  return Object.freeze(theme) as Theme;
}

const PLAIN_THEME = buildTheme(false);
let cachedDefaultColorTheme: Theme | undefined;

export function createTheme(
  enabled: boolean,
  overrides?: Partial<ThemeStyleMap>,
): Theme {
  if (!enabled) {
    return PLAIN_THEME;
  }
  if (!overrides || Object.keys(overrides).length === 0) {
    return (cachedDefaultColorTheme ??= buildTheme(true, defaultThemeStyles));
  }

  return buildTheme(true, { ...defaultThemeStyles, ...overrides });
}

export function detectColor(
  env: Readonly<Record<string, string | undefined>> = process.env,
  isTTY = Boolean(process.stdout.isTTY),
): boolean {
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== "") {
    return false;
  }
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== "") {
    return env.FORCE_COLOR !== "0";
  }
  if (env.TERM === "dumb") {
    return false;
  }

  return isTTY;
}

export function detectUnicode(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  if (process.platform !== "win32") {
    return env.TERM !== "linux";
  }

  return (
    Boolean(env.WT_SESSION) ||
    Boolean(env.TERMINUS_SUBLIME) ||
    env.ConEmuTask === "{cmd::Cmder}" ||
    env.TERM_PROGRAM === "vscode" ||
    env.TERM === "xterm-256color" ||
    env.TERM === "alacritty"
  );
}
