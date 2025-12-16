import type { Command as TabCommand } from "@bomb.sh/tab";
import t from "@bomb.sh/tab";
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

export function resetTab(): void {
	t.commands.clear();
	t.options.clear();
	t.arguments.clear();
	t.completions = [];
}

function registerFlag(
	tc: TabCommand,
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
	tc: TabCommand,
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
