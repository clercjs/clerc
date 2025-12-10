import type { FlagType } from "@clerc/parser";

export function print(s: string) {
	process.stdout.write(s);
}

export function formatFlagType(type: FlagType): string {
	if (typeof type === "function") {
		return type.name;
	}

	return `Array<${type[0].name}>`;
}
