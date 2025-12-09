// TODO: unit tests

import { definePlugin } from "@clerc/core";
import { joinWithAnd } from "@clerc/utils";

export const strictFlagsPlugin = () =>
	definePlugin({
		setup: (cli) => {
			cli.interceptor(async (ctx, next) => {
				const keys = Object.keys(ctx.rawParsed.unknown);
				if (!ctx.resolved || keys.length === 0) {
					await next();
				} else {
					const error =
						keys.length > 1
							? new Error(`Unexpected flags: ${joinWithAnd(keys)}`)
							: new Error(`Unexpected flag: ${keys[0]}`);
					throw error;
				}
			});
		},
	});
