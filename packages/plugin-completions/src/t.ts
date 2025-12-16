import type { Command } from "@bomb.sh/tab";
import t from "@bomb.sh/tab";
import type { ClercFlagsDefinition, CommandsMap } from "clerc";
import { normalizeFlagValue } from "clerc";

export function resetTab(): void {
	t.commands.clear();
	t.options.clear();
	t.arguments.clear();
	t.completions = [];
}

function registerGlobalFlags(
	globalFlags: ClercFlagsDefinition,
	tc: Command,
): void {
	for (const [flagName, def] of Object.entries(globalFlags)) {
		const normalized = normalizeFlagValue(def);
		const desc = normalized.description ?? "";
		const isBoolean = normalized.type === Boolean;
		if (isBoolean) {
			tc.option(flagName, desc, normalized.short);
		} else {
			tc.option(flagName, desc, () => {}, normalized.short);
		}
	}
}

export function buildTabModel(
	globalFlags: ClercFlagsDefinition,
	commands: CommandsMap,
): void {
	resetTab();

	registerGlobalFlags(globalFlags, t);

	for (const cmd of commands.values()) {
		if (cmd.completions?.show === false) {
			continue;
		}

		let command: Command = t;

		if (cmd.name !== "") {
			command = t.command(cmd.name, cmd.description ?? "");
			registerGlobalFlags(globalFlags, command);
		}

		for (const [flagName, def] of Object.entries(cmd.flags ?? {})) {
			const normalized = normalizeFlagValue(def);
			const desc = normalized.description ?? "";
			const isBoolean = normalized.type === Boolean;
			if (isBoolean) {
				command.option(flagName, desc, normalized.short);
			} else {
				command.option(flagName, desc, () => {}, normalized.short);
			}
		}
	}
}
