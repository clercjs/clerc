import t from "@bomb.sh/tab";
import type { ClercFlagsDefinition, CommandsMap } from "clerc";
import { normalizeFlagValue } from "clerc";

export function resetTab(): void {
	t.commands.clear();
	t.options.clear();
	t.arguments.clear();
	t.completions = [];
}

export function buildTabModel(
	globalFlags: ClercFlagsDefinition,
	commands: CommandsMap,
): void {
	resetTab();

	for (const [flagName, def] of Object.entries(globalFlags)) {
		const normalized = normalizeFlagValue(def);
		const desc = normalized.description ?? "";
		t.option(flagName, desc, normalized.short);
	}

	for (const cmd of commands.values()) {
		if (cmd.completions?.show === false) {
			continue;
		}

		const command = t.command(cmd.name, cmd.description ?? "");
		const flags = cmd.flags ?? {};
		for (const [flagName, def] of Object.entries(flags)) {
			const normalized = normalizeFlagValue(def);
			const desc = normalized.description ?? "";
			command.option(flagName, desc, normalized.short);
		}
	}
}
