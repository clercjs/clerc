export type * as Parser from "@clerc/parser";
export {
  DOUBLE_DASH,
  InvalidSchemaError,
  KNOWN_FLAG,
  PARAMETER,
  UNKNOWN_FLAG,
  camelCase,
  inferDefault,
} from "@clerc/parser";
export { Clerc } from "./cli";
export type { ArgvResolution, ArgvScanFn } from "./command-tree";
export { CommandTree } from "./command-tree";
export * from "./errors";
export { normalizeFlagValue } from "./flags";
export {
  createStopAtFirstParameter,
  defineCommand,
  definePlugin,
} from "./helpers";
export type {
  CalloutOptions,
  CalloutTone,
  CreateLoggerOptions,
  LogFormat,
  LogLevel,
  LogStyle,
  Logger,
  LoggerOptions,
} from "./logger";
export { createLogger } from "./logger";
export type { ParameterInfo } from "./parameter";
export {
  extractParameterInfo,
  normalizeParameterValue,
  parseParameters,
} from "./parameter";
export type {
  StandardSchemaV1,
  StandardSchemaV1FailureResult,
  StandardSchemaV1Issue,
  StandardSchemaV1PathSegment,
  StandardSchemaV1Props,
  StandardSchemaV1Result,
  StandardSchemaV1SuccessResult,
  StandardSchemaV1Types,
} from "./schema";
export {
  Enum,
  FlagValidationError,
  Integer,
  Range,
  Regex,
  Types,
  convertValue,
  isStandardSchema,
  validateStandardSchema,
} from "./schema";
export type {
  MemoryTerminal,
  MemoryTerminalOptions,
  Terminal,
} from "./terminal";
export {
  createMemoryTerminal,
  createTerminal,
  defaultPlatformArgv,
} from "./terminal";
export type { StyleFormat, Theme, ThemeStyleMap, ThemeToken } from "./theme";
export { createTheme, defaultThemeStyles, monoThemeStyles } from "./theme";
export type * from "./types";
export type * from "./utils";
export {
  formatFlagName,
  formatVersion,
  joinWithAnd,
  kebabCase,
  resolveAsyncValue,
  toArray,
} from "./utils";
