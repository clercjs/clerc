import type { FlagType } from "@clerc/parser";

export interface Formatters {
	formatFlagType: (type: FlagType) => string;
}
