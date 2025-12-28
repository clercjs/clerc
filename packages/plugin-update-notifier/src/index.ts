import type { Plugin } from "@clerc/core";
import { definePlugin } from "@clerc/core";
import type { UpdateNotifier } from "update-notifier";
import updateNotifier from "update-notifier";

import type { EnhancedNotifierSettings, EnhancedNotifyOptions } from "./types";

export interface UpdateNotifierPluginOptions extends EnhancedNotifierSettings {
  notify?: EnhancedNotifyOptions;
}

declare module "@clerc/core" {
  export interface ContextStore {
    /**
     * The update-notifier instance, available if plugin-update-notifier is
     * used.
     */
    updateNotifier?: UpdateNotifier;
  }
}

/**
 * Plugin to check for CLI updates using update-notifier.
 *
 * @example
 *
 * ```ts
 * import { Clerc } from "@clerc/core";
 * import { updateNotifierPlugin } from "@clerc/plugin-update-notifier";
 * import pkg from "./package.json";
 *
 * Clerc.create().use(updateNotifierPlugin({ pkg })).parse();
 * ```
 */
export const updateNotifierPlugin = ({
  notify: notifySettings,
  ...notifierSettings
}: UpdateNotifierPluginOptions): Plugin =>
  definePlugin({
    setup: (cli) => {
      const notifier = updateNotifier(notifierSettings);

      cli.store.updateNotifier = notifier;

      cli.interceptor({
        enforce: "pre",
        handler: async (ctx, next) => {
          showNotification(notifier, notifySettings);
          await next();
        },
      });
    },
  });

function showNotification(
  notifier: UpdateNotifier,
  notifySettings?: EnhancedNotifyOptions,
): void {
  if (notifier.update) {
    if (typeof notifySettings?.message === "function") {
      notifySettings.message = notifySettings.message(notifier);
    }
    notifier.notify({
      defer: false,
      ...notifySettings,
      message: notifySettings?.message,
    });
  }
}
