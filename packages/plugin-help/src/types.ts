import type { FlagType } from "@clerc/parser";

export interface Formatters {
	formatFlagType: (flagType: FlagType) => string;
}
