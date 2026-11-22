import { styleText } from "node:util";

import type { Plugin } from "@clerc/core";
import { definePlugin } from "@clerc/core";

export interface FriendlyErrorPluginOptions {
  target?: (str: string) => void;
}

function defaultTarget(str: string): void {
  console.error(
    `${styleText(["bgRed", "black", "bold"], " ERROR ")} ${styleText("red", str)}`,
  );
}

export const friendlyErrorPlugin = ({
  target = defaultTarget,
}: FriendlyErrorPluginOptions = {}): Plugin =>
  definePlugin({
    setup: (cli) =>
      cli.errorHandler((err: any) => {
        target(err.message);
        process.exit(1);
      }),
  });
