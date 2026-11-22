import type { ClercPlugin } from "@clerc/core";
import { NoCommandError, UnknownCommandError, definePlugin } from "@clerc/core";

import { findClosest } from "./suggest";

export interface NotFoundPluginOptions {
  readonly distanceThreshold?: number;
}

export function notFoundPlugin(
  options: NotFoundPluginOptions = {},
): ClercPlugin {
  const { distanceThreshold = 4 } = options;

  return definePlugin({
    name: "clerc:not-found",
    hooks: {
      onError: (error, ctx) => {
        if (error instanceof NoCommandError) {
          const visible = ctx.model.tree
            .listVisibleChildren(ctx.model.tree.root)
            .map((n) => n.name);

          if (visible.length > 0) {
            error.addHint(`available commands: ${visible.join(", ")}`);
          }

          return error;
        }

        if (error instanceof UnknownCommandError) {
          const parentNode =
            error.parentPath.length > 0
              ? ctx.model.tree.findNode(error.parentPath)
              : ctx.model.tree.root;
          const visible = ctx.model.tree.listVisibleChildren(parentNode);
          const candidates = visible.map((n) => n.fullPath.join(" "));

          if (candidates.length > 0) {
            const match = findClosest(
              error.commandName,
              candidates,
              distanceThreshold,
            );
            if (match) {
              error.addHint(`a similar command exists: '${match}'`);
            } else if (error.parentPath.length > 0) {
              error.addHint(
                `available subcommands: ${visible.map((n) => n.name).join(", ")}`,
              );
            }
          }

          return error;
        }
      },
    },
  });
}
