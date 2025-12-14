import type { Clerc, ClercFlagsDefinition } from "@clerc/core";
import { DOUBLE_DASH, normalizeFlagValue, resolveCommand } from "@clerc/core";
import { formatFlagName, toArray } from "@clerc/utils";
import type { CompletionItem, ParseEnvResult } from "@pnpm/tabtab";

function splitCommand(cmd: string) {
	const args: string[] = [];
	let current = "";
	let quote: string | null = null;
	let escape = false;

	for (const char of cmd) {
		if (escape) {
			current += char;
			escape = false;
			continue;
		}
		if (char === "\\") {
			escape = true;
			continue;
		}
		if (quote) {
			if (char === quote) {
				quote = null;
			} else {
				current += char;
			}
		} else {
			if (char === '"' || char === "'") {
				quote = char;
			} else if (/\s/.test(char)) {
				if (current) {
					args.push(current);
					current = "";
				}
			} else {
				current += char;
			}
		}
	}
	if (current) {
		args.push(current);
	}

	return args;
}

export async function getCompletion(
	cli: Clerc,
	env: ParseEnvResult,
): Promise<CompletionItem[]> {
	const finishedArgv = env.partial.slice(
		0,
		env.partial.length - env.lastPartial.length,
	);
	const inputArgv = splitCommand(finishedArgv).slice(1);

	if (inputArgv.includes(DOUBLE_DASH)) {
		return [];
	}

	const [command, commandName] = resolveCommand(cli._commands, inputArgv);

	const lastPartial = env.lastPartial;
	const isOption = lastPartial.startsWith("-");

	if (isOption) {
		const flags: ClercFlagsDefinition = command
			? { ...cli._globalFlags, ...command.flags }
			: cli._globalFlags;

		const candidates: CompletionItem[] = [];
		for (const [name, def] of Object.entries(flags)) {
			const normalized = normalizeFlagValue(def);
			const names = [name, ...toArray(normalized.alias ?? [])];
			for (const name of names) {
				candidates.push({
					name: formatFlagName(name),
					description: normalized.description,
				});
			}
		}

		return candidates;
	}

	const candidates: CompletionItem[] = [];
	let prefix = "";
	if (commandName) {
		const matchedParts = commandName.split(" ");
		const remainingArgs = inputArgv.slice(matchedParts.length);
		prefix = `${[command.name, ...remainingArgs].join(" ")} `;
	} else {
		prefix = inputArgv.length > 0 ? `${inputArgv.join(" ")} ` : "";
	}

	for (const command of cli._commands.values()) {
		if (command.completions?.show === false) {
			continue;
		}

		if (command.name.startsWith(prefix)) {
			const remaining = command.name.slice(prefix.length);
			// Only suggest the next word
			const nextWord = remaining.split(" ")[0];
			if (nextWord) {
				candidates.push({
					name: nextWord,
					description: command.description,
				});
			}
		}
	}

	// Deduplicate
	const uniqueCandidates = new Map();
	for (const c of candidates) {
		uniqueCandidates.set(c.name, c);
	}

	return [...uniqueCandidates.values()];
}
