import type { ReadonlyCliMeta } from "@clerc/core";
import { definePlugin, formatVersion } from "@clerc/core";

export interface VersionPluginOptions<Flag extends boolean = true> {
  readonly command?: boolean;
  readonly flag?: Flag;
  readonly format?: (meta: ReadonlyCliMeta) => string;
}

const VERSION_GLOBAL_FLAGS = {
  version: {
    type: Boolean,
    short: "V",
    description: "Show version",
  },
} as const;

const defaultFormat = (meta: ReadonlyCliMeta): string =>
  `${meta.scriptName} ${formatVersion(meta.version)}`.trim();

export function versionPlugin<const Flag extends boolean = true>(
  options?: VersionPluginOptions<Flag>,
) {
  const command = options?.command ?? true;
  const flag = options?.flag ?? true;
  const format = options?.format ?? defaultFormat;
  const globalFlags = (
    flag ? VERSION_GLOBAL_FLAGS : undefined
  ) as Flag extends true ? typeof VERSION_GLOBAL_FLAGS : {};

  return definePlugin({
    name: "clerc:version",
    globalFlags,
    commands: command
      ? () => [
          {
            name: "version",
            description: "Show version",
            run: (ctx) => {
              ctx.terminal.stdout(format(ctx.meta));
            },
          },
        ]
      : undefined,
    hooks: {
      onIntercept: (ctx) => {
        if (flag && ctx.flags.version) {
          ctx.terminal.stdout(format(ctx.meta));

          return { handled: true, exitCode: 0 };
        }
      },
    },
  });
}
