import type { IgnoreFunction, ParsedResult } from "./types";

export const KNOWN_FLAG = "known-flag";
export const UNKNOWN_FLAG = "unknown-flag";
export const PARAMETER = "parameter";

export interface ArgsIterator {
  current: string;
  index: number;
  hasNext: boolean;
  next: string;
  shouldIgnore: (arg: string) => boolean;
  advance: () => string;
  advanceUnknown: () => string;
  markUnknown: () => void;
  exit: (push?: boolean) => void;
}

export function iterateArgs(
  args: string[],
  result: ParsedResult<any>,
  shouldProcessAsFlag: (arg: string) => boolean,
  isKnownFlag: (arg: string) => boolean,
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
    shouldIgnore: (arg: string) => {
      if (ignore) {
        const isFlag = shouldProcessAsFlag(arg);
        const argType = isFlag
          ? isKnownFlag(arg)
            ? KNOWN_FLAG
            : UNKNOWN_FLAG
          : PARAMETER;

        return ignore(argType, arg);
      }

      return false;
    },
    advance: () => {
      if (iterator.shouldIgnore(iterator.next)) {
        iterator.exit();

        return "";
      }
      index++;
      updateState();

      return args[index];
    },
    advanceUnknown: () => {
      const value = iterator.advance();
      if (value) {
        result.rawUnknown.push(value);
      }

      return value;
    },
    markUnknown: () => {
      result.rawUnknown.push(iterator.current);
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

  function updateState() {
    iterator.current = args[index];
    iterator.index = index;
    iterator.hasNext = index + 1 < argsLength;
    iterator.next = iterator.hasNext ? args[index + 1] : "";
  }

  for (index = 0; index < argsLength; index++) {
    if (stopped) {
      break;
    }

    updateState();

    callback(iterator);
  }
}
