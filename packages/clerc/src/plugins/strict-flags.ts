import { UnknownFlagError, formatFlagName, plugin } from "@clerc/core";

import { findClosest } from "../utils/suggest";

export interface StrictFlagsPluginOptions {
  /**
   * Maximum Levenshtein distance for option suggestions (set 0 to disable).
   */
  readonly distanceThreshold?: number;
}

export function strictFlagsPlugin(options: StrictFlagsPluginOptions = {}) {
  const { distanceThreshold = 3 } = options;

  return plugin("clerc:strict-flags").hook("validate", (ctx) => {
    const unknownKeys = Object.keys(ctx.unknown);
    if (unknownKeys.length === 0) {
      return;
    }

    const knownFlags = [
      ...Object.keys(ctx.model.globalFlags),
      ...Object.keys(ctx.command?.flags ?? {}),
    ];

    const hints: string[] = [];
    if (distanceThreshold > 0 && knownFlags.length > 0) {
      for (const unknown of unknownKeys) {
        if (unknown.length <= 1) {
          continue;
        }
        const suggestion = findClosest(unknown, knownFlags, distanceThreshold);
        if (suggestion) {
          hints.push(
            `a similar option exists: '${formatFlagName(suggestion)}'`,
          );
        }
      }
    }

    throw new UnknownFlagError(unknownKeys, hints);
  });
}
