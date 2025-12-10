// TODO: unit tests

import type { Plugin } from "@clerc/core";
import { definePlugin } from "@clerc/core";
import * as kons from "kons";

export interface FriendlyErrorPluginOptions {
	target?: (str: string) => void;
}

export const friendlyErrorPlugin = ({
	target = kons.error,
}: FriendlyErrorPluginOptions = {}): Plugin =>
	definePlugin({
		setup: (cli) =>
			cli.errorHandler((err: any) => {
				target(err.message);
				process.exit(1);
			}),
	});
