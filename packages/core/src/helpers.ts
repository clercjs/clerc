import type { IgnoreFunction } from "@clerc/parser";
import { PARAMETER } from "@clerc/parser";

export function createStopAtFirstParameter(): IgnoreFunction {
  let encounteredParameter = false;

  return (type) => {
    if (type === PARAMETER && !encounteredParameter) {
      encounteredParameter = true;

      return false;
    }

    return encounteredParameter;
  };
}
