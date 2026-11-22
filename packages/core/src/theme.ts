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
  brand: ["bold", "cyan"],
  heading: "bold",
  command: "bold",
  flag: ["bold", "cyan"],
  placeholder: "dim",
  muted: "dim",
  error: ["bold", "red"],
  warn: ["bold", "yellow"],
  success: ["bold", "green"],
  info: ["bold", "blue"],
  accent: "cyan",
  code: "bold",
  bold: "bold",
  dim: "dim",
};

export const monoThemeStyles: ThemeStyleMap = {
  brand: "bold",
  heading: "bold",
  command: "bold",
  flag: "bold",
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

const TOKENS = Object.keys(defaultThemeStyles) as readonly ThemeToken[];
const identity = (text: string): string => text;

function buildTheme(enabled: boolean, styles?: ThemeStyleMap): Theme {
  const theme: Record<string, unknown> = { enabled };
  for (const token of TOKENS) {
    const format = styles?.[token];
    theme[token] =
      enabled && format
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
