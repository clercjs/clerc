import type { IgnoreFunction } from "@clerc/parser";
import { PARAMETER } from "@clerc/parser";

export function createStopAtFirstParameter(): IgnoreFunction {
  let encounteredParameter = false;

  return (type) => {
    if (type === PARAMETER && !encounteredParameter) {
      encounteredParameter = true;

      return false; // Allow first parameter
    }

    // If a parameter has been encountered, stop all subsequent parsing
    return encounteredParameter;
  };
}
