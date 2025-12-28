import { looseIsArray } from "@clerc/utils";
import { IS_DENO, IS_ELECTRON, IS_NODE } from "is-platform";

import type { ClercFlagDefinitionValue, ClercFlagOptions } from "./types/flag";
import type {
  ParameterDefinitionValue,
  ParameterOptions,
} from "./types/parameter";

export const resolveArgv = (): string[] =>
  IS_NODE
    ? process.argv.slice(IS_ELECTRON ? 1 : 2)
    : IS_DENO
      ? // @ts-expect-error Ignore
        Deno.args
      : [];

export const normalizeFlagValue = (
  flag: ClercFlagDefinitionValue,
): ClercFlagOptions =>
  typeof flag === "function" || looseIsArray(flag) ? { type: flag } : flag;

export const normalizeParameterValue = (
  parameter: ParameterDefinitionValue,
): ParameterOptions =>
  typeof parameter === "string" ? { key: parameter } : parameter;
