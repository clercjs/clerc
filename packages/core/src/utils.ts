import { looseIsArray } from "@clerc/utils";

import type { ClercFlagDefinitionValue, ClercFlagOptions } from "./types/flag";
import type {
  ParameterDefinitionValue,
  ParameterOptions,
} from "./types/parameter";

export const normalizeFlagValue = (
  flag: ClercFlagDefinitionValue,
): ClercFlagOptions =>
  typeof flag === "function" || looseIsArray(flag) ? { type: flag } : flag;

export const normalizeParameterValue = (
  parameter: ParameterDefinitionValue,
): ParameterOptions =>
  typeof parameter === "string" ? { key: parameter } : parameter;
