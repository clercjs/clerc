export { InvalidSchemaError } from "./errors";
export { camelCase } from "./helpers";
export type { ScanCallback, ScanResult } from "./parse";
export {
  DOUBLE_DASH,
  KNOWN_FLAG,
  PARAMETER,
  UNKNOWN_FLAG,
  createParser,
  parse,
} from "./parse";
export type * from "./types";
export { inferDefault, setDotValues } from "./utils";
