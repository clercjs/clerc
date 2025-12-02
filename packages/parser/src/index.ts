import minimist from "minimist";

import type { FlagOption, ParsedResult, ParserOptions } from "./types";

const toArray = <T>(a: T | T[]) => (Array.isArray(a) ? a : [a]);

function toMinimistOptions(flags: Record<string, FlagOption>) {
	const options = {
		alias: {} as Record<string, string[]>,
		boolean: [],
		string: [],
		default: {},
	} satisfies minimist.Opts;
	for (const flagName in flags) {
		const flag = flags[flagName];
		if (flag.alias) {
			options.alias[flagName] = toArray(flag.alias);
		}
		if (flag.type === Boolean) {
			(options.boolean as string[]).push(flagName);
		}
		if (flag.type === String || flag.type === Number) {
			(options.string as string[]).push(flagName);
		}
	}

	return options;
}

export function createParser(options: ParserOptions) {
	const minimistOptions = toMinimistOptions(options.flags);
	const knownFlags = new Set(Object.keys(options.flags));
	for (const flag of Object.values(options.flags)) {
		if (flag.alias) {
			for (const a of toArray(flag.alias)) {
				knownFlags.add(a);
			}
		}
	}

	return {
		parse: (argv: string[]): ParsedResult => {
			const parsed = minimist(argv, minimistOptions);
			const { _: Positional, ...rest } = parsed;
			const flags: Record<string, any> = {};
			const unknownFlags: Record<string, any> = {};

			for (const flagName in rest) {
				if (knownFlags.has(flagName)) {
					flags[flagName] = rest[flagName];
				} else {
					unknownFlags[flagName] = rest[flagName];
				}
			}

			return {
				flags,
				unknownFlags,
				_: Positional,
			};
		},
	};
}
