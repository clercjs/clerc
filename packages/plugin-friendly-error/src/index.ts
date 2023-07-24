// TODO: unit tests

import { definePlugin } from "@clerc/core";
import * as kons from "kons";

export const friendlyErrorPlugin = () =>
	definePlugin({
		setup: (cli) =>
			cli.errorHandler((error) => {
				kons.error(error.message);
				process.exit(1);
			}),
	});
