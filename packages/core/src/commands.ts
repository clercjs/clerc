import type { Command, CommandsMap } from "./types";

export function resolveCommand(
	commandsMap: CommandsMap,
	parameters: string[],
): [Command, string] | [undefined, undefined] {
	for (let i = parameters.length; i >= 0; i--) {
		const name = parameters.slice(0, i).join(" ");
		if (commandsMap.has(name)) {
			return [commandsMap.get(name)!, name];
		}
	}

	return [undefined, undefined];
}
