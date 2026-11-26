export const SUPPORTED_SHELLS = ["zsh", "bash", "fish", "powershell"] as const;

export type SupportedShell = (typeof SUPPORTED_SHELLS)[number];

export const ShellCompDirective = {
  Default: 0,
  Error: 1,
  NoSpace: 2,
  NoFileComp: 4,
  FilterFileExt: 8,
  FilterDirs: 16,
  KeepOrder: 32,
} as const;
