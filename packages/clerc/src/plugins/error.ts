import {
  ClercError,
  NoCommandError,
  UnknownCommandError,
  formatDiagnostic,
  plugin,
} from "@clerc/core";

import { findClosest } from "../utils/suggest";

export interface ErrorPluginOptions {
  readonly showHelpHint?: boolean;
  readonly showStack?: boolean;
  /**
   * Maximum Levenshtein distance for command suggestions (set 0 to disable).
   */
  readonly distanceThreshold?: number;
}

export function errorPlugin(options: ErrorPluginOptions = {}) {
  const { showHelpHint = true, showStack, distanceThreshold = 4 } = options;

  return plugin("clerc:errors")
    .hook("error", (error, ctx) => {
      if (distanceThreshold <= 0) {
        return;
      }

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
    })
    .hook("renderError", (error, ctx) => {
      const verbose =
        showStack ??
        (ctx.log.level === "debug" ||
          Boolean(ctx.terminal.env.DEBUG && ctx.terminal.env.DEBUG !== "0"));

      if (ctx.log.format === "json") {
        const payload =
          error instanceof ClercError
            ? {
                error: {
                  code: error.code,
                  message: error.message,
                  detail: error.detail,
                  hints: error.hints,
                  exitCode: error.exitCode,
                },
              }
            : {
                error: {
                  message:
                    error instanceof Error ? error.message : String(error),
                  exitCode: 1,
                },
              };
        ctx.terminal.stderr(JSON.stringify(payload));

        return true;
      }

      const formatted = formatDiagnostic(error, {
        theme: ctx.theme,
        scriptName: ctx.meta.scriptName,
        commandPath: ctx.node?.fullPath,
        verbose,
        showHelpHint,
      });
      ctx.terminal.stderr(formatted);

      return true;
    });
}
