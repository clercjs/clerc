import type { ClercPlugin } from "@clerc/core";
import { ClercError, definePlugin, formatDiagnostic } from "@clerc/core";

export interface ErrorPluginOptions {
  readonly showHelpHint?: boolean;
  readonly showStack?: boolean;
}

export function errorPlugin(options: ErrorPluginOptions = {}): ClercPlugin {
  const { showHelpHint = true, showStack } = options;

  return definePlugin({
    name: "clerc:error",
    hooks: {
      onRenderError: (error, ctx) => {
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
      },
    },
  });
}
