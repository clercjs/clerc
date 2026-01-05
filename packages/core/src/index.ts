export * as Types from "@clerc/advanced-types";
export type * as Parser from "@clerc/parser";
export {
  DOUBLE_DASH,
  InvalidSchemaError,
  KNOWN_FLAG,
  PARAMETER,
  UNKNOWN_FLAG,
  appendDotValues,
  coerceObjectValue,
  isObjectType,
  objectType,
  setDotValues,
} from "@clerc/parser";
export type { CreateOptions, ParseOptions } from "./cli";
export { Clerc } from "./cli";
export { resolveCommand } from "./command";
export * from "./errors";
export * from "./helpers";
export { createStopAtFirstParameter } from "./ignore";
export { extractParameterInfo } from "./parameter";
export { definePlugin } from "./plugin";
export type * from "./types";
export { normalizeFlagValue, normalizeParameterValue } from "./utils";
