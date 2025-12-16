import type { Command } from "@bomb.sh/tab";
import t from "@bomb.sh/tab";
import type {
	ClercFlagDefinitionValue,
	ClercFlagsDefinition,
	CommandsMap,
} from "clerc";
import { normalizeFlagValue } from "clerc";

export function resetTab(): void {
	t.commands.clear();
	t.options.clear();
	t.arguments.clear();
	t.completions = [];
}

function registerFlag(
	tc: Command,
	flagName: string,
	def: ClercFlagDefinitionValue,
): void {
	const normalized = normalizeFlagValue(def);
	const desc = normalized.description ?? "";
	if (normalized.type === Boolean) {
		tc.option(flagName, desc, undefined, normalized.short);
	} else {
		tc.option(
			flagName,
			desc,
			normalized.completions?.handler,
			normalized.short,
		);
	}
}

function registerGlobalFlags(
	globalFlags: ClercFlagsDefinition,
	tc: Command,
): void {
	for (const [flagName, def] of Object.entries(globalFlags)) {
		registerFlag(tc, flagName, def);
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
			registerFlag(command, flagName, def);
		}
	}
}
