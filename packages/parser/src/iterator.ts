import type { IgnoreFunction, ParsedResult } from "./types";

export const FLAG = "flag";
export const PARAMETER = "parameter";

export interface ArgsIterator {
	current: string;
	index: number;
	hasNext: boolean;
	next: string;
	check: (arg: string) => boolean;
	eat: () => string | undefined;
	exit: (push?: boolean) => void;
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
	const argsLength = args.length;

	const iterator: ArgsIterator = {
		current: "",
		index: 0,
		hasNext: false,
		next: "",
		check: (arg: string) => {
			if (ignore) {
				const argType = shouldProcessAsFlag(arg) ? FLAG : PARAMETER;

				return ignore(argType, arg);
			}

			return false;
		},
		eat: (): string | undefined => {
			if (index + 1 >= argsLength) {
				return undefined;
			}
			const nextArg = args[index + 1];

			if (iterator.check(nextArg)) {
				iterator.exit();

				return undefined;
			}

			index++;
			next();

			return args[index];
		},
		exit: (push = true) => {
			if (!stopped) {
				if (push) {
					result.ignored.push(...args.slice(index + 1));
				}
				stopped = true;
			}
		},
	};

	function next() {
		iterator.current = args[index];
		iterator.index = index;
		iterator.hasNext = index + 1 < argsLength;
		iterator.next = iterator.hasNext ? args[index + 1] : "";
	}

	for (index = 0; index < argsLength; index++) {
		if (stopped) {
			break;
		}

		next();

		callback(iterator);
	}
}
