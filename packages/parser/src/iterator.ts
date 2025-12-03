import type { IgnoreFunction, ParsedResult } from "./types";

export const FLAG = "flag";
export const PARAMETER = "parameter";

export interface ArgsIterator {
	readonly current: string;
	readonly index: number;
	readonly hasNext: boolean;
	readonly next: string;
	check: (arg: string) => boolean;
	eat: () => string | undefined;
	exit: () => void;
}

export function iterateArgs(
	args: string[],
	result: ParsedResult<any>,
	shouldProcessAsFlag: (arg: string) => boolean,
	ignore: IgnoreFunction | undefined,
	callback: (iterator: ArgsIterator) => void,
): void {
	let index = 0;
	let stopped = false;

	const iterator: ArgsIterator = {
		get current() {
			return args[index];
		},
		get index() {
			return index;
		},
		get hasNext() {
			return index + 1 < args.length;
		},
		get next() {
			return args[index + 1];
		},
		check(arg: string) {
			if (ignore) {
				const argType = shouldProcessAsFlag(arg) ? FLAG : PARAMETER;

				return ignore(argType, arg);
			}

			return false;
		},
		eat(): string | undefined {
			if (!this.hasNext) {
				return undefined;
			}
			const nextArg = args[index + 1];

			if (this.check(nextArg)) {
				this.exit();

				return undefined;
			}

			return args[++index];
		},
		exit() {
			if (!stopped) {
				result.ignored.push(...args.slice(index + 1));
				stopped = true;
			}
		},
	};

	for (index = 0; index < args.length; index++) {
		if (stopped) {
			break;
		}

		callback(iterator);
	}
}
