import type { Plugin, ReadonlyCliMeta } from "@clerc/core";
import { formatVersion, plugin } from "@clerc/core";

export interface VersionPluginOptions<Flag extends boolean = true> {
  readonly command?: boolean;
  readonly flag?: Flag;
  readonly format?: (meta: ReadonlyCliMeta) => string;
}

const VERSION_FLAG = {
  type: Boolean,
  short: "V",
  description: "Show version",
} as const;

const defaultFormat = (meta: ReadonlyCliMeta): string =>
  `${meta.scriptName} ${formatVersion(meta.version)}`.trim();

export function versionPlugin<const Flag extends boolean = true>(
  options?: VersionPluginOptions<Flag>,
) {
  const command = options?.command ?? true;
  const flag = options?.flag ?? true;
  const format = options?.format ?? defaultFormat;

  const p = plugin("clerc:version");
  if (command) {
    p.command("version", {
      description: "Show version",
      run(ctx) {
        ctx.terminal.stdout(format(ctx.meta));
      },
    });
  }
  if (flag) {
    p.flags({ version: VERSION_FLAG }).hook("intercept", (ctx) => {
      if (ctx.flags.version) {
        ctx.terminal.stdout(format(ctx.meta));

        return { handled: true, exitCode: 0 };
      }
    });
  }

  return p as Plugin<
    Flag extends true ? { readonly version: typeof VERSION_FLAG } : {}
  >;
}
