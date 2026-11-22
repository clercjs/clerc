import type { ClercPlugin } from "@clerc/core";
import { UnknownFlagError, definePlugin, formatFlagName } from "@clerc/core";
import { closest, distance } from "fastest-levenshtein";

export interface StrictFlagsPluginOptions {
  readonly distanceThreshold?: number;
}

export function strictFlagsPlugin(
  options: StrictFlagsPluginOptions = {},
): ClercPlugin {
  const { distanceThreshold = 3 } = options;

  return definePlugin({
    name: "clerc:strict-flags",
    hooks: {
      onValidate: (ctx) => {
        const unknownKeys = Object.keys(ctx.unknown);
        if (unknownKeys.length === 0) {
          return;
        }

        const knownFlags = [
          ...Object.keys(ctx.model.globalFlags),
          ...Object.keys(ctx.command?.flags ?? {}),
        ];

        const hints: string[] = [];
        if (knownFlags.length > 0) {
          for (const unknown of unknownKeys) {
            if (unknown.length <= 1) {
              continue;
            }
            const suggestion = closest(unknown, knownFlags);
            if (
              suggestion &&
              distance(unknown, suggestion) <= distanceThreshold
            ) {
              hints.push(
                `a similar option exists: '${formatFlagName(suggestion)}'`,
              );
            }
          }
        }

        throw new UnknownFlagError(unknownKeys, hints);
      },
    },
  });
}
