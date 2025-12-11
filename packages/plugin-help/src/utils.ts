import type { FlagType } from "@clerc/parser";

export function formatFlagType(type: FlagType): string {
	if (typeof type === "function") {
		return type.displayName ?? type.name;
	}

	const innerType = type[0] as any;

	return `Array<${innerType.displayName ?? innerType.name}>`;
}
