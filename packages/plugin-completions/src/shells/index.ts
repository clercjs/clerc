import type { CliModel } from "clerc";

import type { SupportedShell } from "../directives";
import { SUPPORTED_SHELLS, ShellCompDirective } from "../directives";
import { buildCompletionSpec } from "../spec";
import { renderBashScript } from "./bash";
import { renderFishScript } from "./fish";
import { renderPowerShellScript } from "./powershell";
import { renderZshScript } from "./zsh";

export type { SupportedShell };
export { SUPPORTED_SHELLS, ShellCompDirective };

export function renderCompletionScript(
  shell: SupportedShell,
  model: CliModel,
  executable?: string,
): string {
  const spec = buildCompletionSpec(model, executable);
  switch (shell) {
    case "zsh": {
      return renderZshScript(spec);
    }
    case "bash": {
      return renderBashScript(spec);
    }
    case "fish": {
      return renderFishScript(spec);
    }
    case "powershell": {
      return renderPowerShellScript(spec);
    }
  }
}
