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

export function createTheme(
  enabled: boolean,
  overrides: Partial<ThemeStyleMap> = {},
): Theme {
  const styles: ThemeStyleMap = {
    ...defaultThemeStyles,
    ...overrides,
  };

  const apply = (format: StyleFormat): ((text: string) => string) =>
    enabled
      ? (text: string) => styleText(format, text, { validateStream: false })
      : (text: string) => text;

  return {
    enabled,
    brand: apply(styles.brand),
    heading: apply(styles.heading),
    command: apply(styles.command),
    flag: apply(styles.flag),
    placeholder: apply(styles.placeholder),
    muted: apply(styles.muted),
    error: apply(styles.error),
    warn: apply(styles.warn),
    success: apply(styles.success),
    info: apply(styles.info),
    accent: apply(styles.accent),
    code: apply(styles.code),
    bold: apply(styles.bold),
    dim: apply(styles.dim),
  };
}
