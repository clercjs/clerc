import bashTemplate from "./bash.bash?raw";
import fishTemplate from "./fish.fish?raw";
import powershellTemplate from "./powershell.ps1?raw";
import zshTemplate from "./zsh.zsh?raw";

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

const sanitizeIdentifier = (name: string): string =>
  name.replace(/[-:./\s]/g, "_");

const applyVars = (template: string, name: string, bin: string): string =>
  template
    .trimEnd()
    .replaceAll("__NAME__", name)
    .replaceAll("__FN__", sanitizeIdentifier(name))
    .replaceAll("__BIN__", bin);

export function renderCompletionScript(
  shell: SupportedShell,
  name: string,
  executable = name,
): string {
  switch (shell) {
    case "zsh": {
      return applyVars(zshTemplate, name, executable);
    }
    case "bash": {
      return applyVars(bashTemplate, name, executable);
    }
    case "fish": {
      return applyVars(fishTemplate, name, executable);
    }
    case "powershell": {
      return applyVars(powershellTemplate, name, executable);
    }
  }
}
