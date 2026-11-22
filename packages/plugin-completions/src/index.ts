import { RootCommand } from "@bomb.sh/tab";
import type { ClercPlugin } from "@clerc/core";
import { ClercError, Types, definePlugin } from "@clerc/core";

import { buildTabModel } from "./t";

export type { CompletionMeta } from "./t";

export function completionsPlugin(): ClercPlugin {
  const supportedShellEnum = Types.Enum("zsh", "bash", "fish", "powershell");

  return definePlugin({
    name: "clerc:completions",
    commands: () => [
      {
        name: "completions",
        description: "Generate shell completion scripts",
        flags: {
          shell: {
            description: "Shell type",
            type: supportedShellEnum,
          },
        },
        parameters: [
          {
            key: "[shell]",
            description: "Shell type",
            type: supportedShellEnum,
          },
        ] as const,
        run: async (ctx) => {
          const shell =
            (ctx.parameters as { shell?: string }).shell ??
            (ctx.flags as { shell?: string }).shell;

          if (!shell) {
            throw new ClercError(
              "shell type is required (zsh, bash, fish, or powershell)",
              {
                code: "ERR_MISSING_PARAMETER",
                exitCode: 2,
                hints: [
                  `run '${ctx.meta.scriptName} completions zsh' or pass '--shell zsh'`,
                ],
              },
            );
          }

          const t = new RootCommand();
          buildTabModel(t, ctx.model);
          t.setup(ctx.meta.scriptName, ctx.meta.scriptName, shell);
        },
      },
      {
        name: "complete",
        hidden: true,
        parameters: ["--", "[input...]"] as const,
        run: async (ctx) => {
          const t = new RootCommand();
          buildTabModel(t, ctx.model);
          const { input } = ctx.parameters as { input: string[] };
          t.parse(input);
        },
      },
    ],
  });
}
