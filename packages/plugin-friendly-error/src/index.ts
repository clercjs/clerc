// TODO: unit tests

import { definePlugin } from "@clerc/core";
import * as kons from "kons";

export interface FriendlyErrorPluginOptions {
	target?: (str: string) => void;
}

export const friendlyErrorPlugin = ({
	target = kons.error,
}: FriendlyErrorPluginOptions = {}) =>
	definePlugin({
		setup: (cli) =>
			cli.errorHandler((err) => {
				target(err.message);
				process.exit(1);
			}),
	});
