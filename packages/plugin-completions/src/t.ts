import type { Command as TabCommand, RootCommand } from "@bomb.sh/tab";
import type {
	ClercFlagDefinitionValue,
	ClercFlagsDefinition,
	CommandsMap,
} from "@clerc/core";
import {
	extractParameterInfo,
	normalizeFlagValue,
	normalizeParameterValue,
} from "@clerc/core";

function registerFlag(
	tc: TabCommand,
	flagName: string,
	def: ClercFlagDefinitionValue,
): void {
	const normalized = normalizeFlagValue(def);
	const desc = normalized.description ?? "";
	if (normalized.type === Boolean) {
		tc.option(flagName, desc, normalized.short);
	} else {
		// idk why put async here, but whatever tab itself also writes it like this:
		// https://github.com/bombshell-dev/tab/blob/56ead3243f14bfb7d841aa203773cdce8bf932b2/src/cac.ts#L109
		const handler = normalized.completions?.handler ?? (async () => {});
		tc.option(flagName, desc, handler, normalized.short);
	}
}

function registerGlobalFlags(
	globalFlags: ClercFlagsDefinition,
	tc: TabCommand,
): void {
	for (const [flagName, def] of Object.entries(globalFlags)) {
		registerFlag(tc, flagName, def);
	}
}

export function buildTabModel(
	t: RootCommand,
	globalFlags: ClercFlagsDefinition,
	commands: CommandsMap,
): void {
	registerGlobalFlags(globalFlags, t);

	for (const cmd of commands.values()) {
		if (cmd.completions?.show === false) {
			continue;
		}

		let command: TabCommand = t;

		if (cmd.name !== "") {
			command = t.command(cmd.name, cmd.description ?? "");
			registerGlobalFlags(globalFlags, command);
		}

		cmd.completions?.handler?.(command);

		for (const def of cmd.parameters ?? []) {
			const normalized = normalizeParameterValue(def);
			const { name, isVariadic } = extractParameterInfo(normalized.key);
			command.argument(name, normalized.completions?.handler, isVariadic);
		}

		for (const [flagName, def] of Object.entries(cmd.flags ?? {})) {
			registerFlag(command, flagName, def);
		}
	}
}
