import type { Clerc, ClercFlagsDefinition, Command } from "@clerc/core";
import {
	formatFlagName,
	formatVersion,
	isTruthy,
	objectIsEmpty,
	toArray,
} from "@clerc/utils";
import stringWidth from "string-width";
import textTable from "text-table";
import * as yc from "yoctocolors";

import type { Formatters, GroupsOptions } from "./types";

const DEFAULT_GROUP_KEY = "default";

const table = (items: string[][]) =>
	textTable(items, { stringLength: stringWidth });

const splitTable = (items: string[][]) => table(items).split("\n");

const DELIMITER = yc.yellow("-");

export type Section =
	| {
			title?: string;
			body: string | (string | undefined)[];
	  }
	| undefined;

function groupDefinitionsToMap(
	definitions?: [string, string][],
): Map<string, string> {
	const map = new Map<string, string>();
	if (definitions) {
		for (const [key, name] of definitions) {
			map.set(key, name);
		}
	}

	return map;
}

function validateGroup(
	group: string | undefined,
	groupMap: Map<string, string>,
	itemType: string,
	itemName: string,
): void {
	if (group && group !== DEFAULT_GROUP_KEY && !groupMap.has(group)) {
		throw new Error(
			`Unknown ${itemType} group "${group}" for "${itemName}". ` +
				`Available groups: ${[...groupMap.keys()].join(", ") || "(none)"}`,
		);
	}
}

export class HelpRenderer {
	private _commandGroups: Map<string, string>;
	private _flagGroups: Map<string, string>;
	private _globalFlagGroups: Map<string, string>;

	constructor(
		private _formatters: Formatters,
		private _cli: Clerc,
		private _globalFlags: ClercFlagsDefinition,
		private _command: Command | undefined,
		private _notes?: string[],
		private _examples?: [string, string][],
		groups?: GroupsOptions,
	) {
		this._commandGroups = groupDefinitionsToMap(groups?.commands);
		this._flagGroups = groupDefinitionsToMap(groups?.flags);
		this._globalFlagGroups = groupDefinitionsToMap(groups?.globalFlags);
	}

	public render(): string {
		const sections: Section[] = [
			this.renderHeader(),
			this.renderUsage(),
			this.renderCommands(),
			this.renderGlobalFlags(),
			this.renderCommandFlags(),
			this.renderNotes(),
			this.renderExamples(),
		];

		return sections
			.filter(isTruthy)
			.filter((section) => section.body.length > 0)
			.map((section) => {
				const body = Array.isArray(section.body)
					? section.body.filter((s) => s !== undefined).join("\n")
					: section.body;

				if (!section.title) {
					return body;
				}

				return `${yc.bold(section.title)}\n${body
					.split("\n")
					.map((line) => `  ${line}`)
					.join("\n")}`;
			})
			.join("\n\n");
	}

	private renderHeader() {
		const { _name, _version, _description } = this._cli;
		const command = this._command;
		const description = command?.description ?? _description;
		const formattedCommandName = command?.name
			? ` ${yc.cyan(command.name)}`
			: "";
		const headerLine = command
			? `${yc.green(_name)}${formattedCommandName}`
			: `${yc.green(_name)} ${yc.yellow(formatVersion(_version))}`;
		const alias = command?.alias
			? `Alias${toArray(command.alias).length > 1 ? "es" : ""}: ${toArray(
					command.alias,
				)
					.map((a) => yc.cyan(a))
					.join(", ")}`
			: undefined;

		return {
			body: [
				`${headerLine}${description ? ` ${DELIMITER} ${description}` : ""}`,
				alias,
			],
		};
	}

	private renderUsage() {
		const { _scriptName } = this._cli;
		const command = this._command;

		let usage = `$ ${_scriptName}`;

		if (command) {
			if (command.name) {
				usage += ` ${command.name}`;
			}
			if (command.parameters) {
				usage += ` ${command.parameters.join(" ")}`;
			}
		} else {
			usage += this._cli._commands.has("") ? " [command]" : " <command>";
		}

		if (
			(command?.flags && !objectIsEmpty(command.flags)) ||
			!objectIsEmpty(this._globalFlags)
		) {
			usage += " [flags]";
		}

		return {
			title: "Usage",
			body: [yc.magenta(usage)],
		};
	}

	private renderCommands() {
		const commands = this._cli._commands;
		if (this._command || commands.size === 0) {
			return;
		}

		// Group commands
		const groupedCommands = new Map<string, string[][]>();
		const defaultCommands: string[][] = [];

		for (const command of commands.values()) {
			if ((command as any).__isAlias || command.help?.show === false) {
				continue;
			}

			const group = command.help?.group;
			validateGroup(group, this._commandGroups, "command", command.name);

			const commandName = yc.cyan(command.name);
			const aliases = command.alias
				? ` (${toArray(command.alias).join(", ")})`
				: "";
			const item = [`${commandName}${aliases}`, command.description];

			if (group && group !== DEFAULT_GROUP_KEY) {
				const groupItems = groupedCommands.get(group) ?? [];
				groupItems.push(item);
				groupedCommands.set(group, groupItems);
			} else {
				defaultCommands.push(item);
			}
		}

		// Build body with groups
		const body: string[] = [];

		// Output defined groups in order
		for (const [key, name] of this._commandGroups) {
			const items = groupedCommands.get(key);
			if (items && items.length > 0) {
				if (body.length > 0) {
					body.push("");
				}
				body.push(`${yc.dim(name)}`);
				for (const line of splitTable(items)) {
					body.push(`  ${line}`);
				}
			}
		}

		// Output default group last
		if (defaultCommands.length > 0) {
			if (body.length > 0) {
				body.push("");
				body.push(`${yc.dim("Other")}`);
				for (const line of splitTable(defaultCommands)) {
					body.push(`  ${line}`);
				}
			} else {
				// No groups defined, output flat
				body.push(...splitTable(defaultCommands));
			}
		}

		return {
			title: "Commands",
			body,
		};
	}

	private renderFlagItem(name: string, flag: ClercFlagsDefinition[string]) {
		const flagName = formatFlagName(name);
		const aliases = (
			Array.isArray(flag.alias) ? flag.alias : flag.alias ? [flag.alias] : []
		)
			.map(formatFlagName)
			.join(", ");
		const type = this._formatters.formatFlagType(flag.type);

		return [
			yc.blue([flagName, aliases].filter(Boolean).join(", ")),
			yc.gray(type),
			flag.description,
			flag.default !== undefined &&
				yc.gray(`[default: ${String(flag.default)}]`),
		].filter(isTruthy);
	}

	private renderGroupedFlags(
		flags: ClercFlagsDefinition,
		groupMap: Map<string, string>,
		itemType: string,
	) {
		const groupedFlags = new Map<string, string[][]>();
		const defaultFlags: string[][] = [];

		for (const [name, flag] of Object.entries(flags)) {
			const group = (flag as any).help?.group as string | undefined;
			validateGroup(group, groupMap, itemType, name);

			const item = this.renderFlagItem(name, flag);

			if (group && group !== DEFAULT_GROUP_KEY) {
				const groupItems = groupedFlags.get(group) ?? [];
				groupItems.push(item);
				groupedFlags.set(group, groupItems);
			} else {
				defaultFlags.push(item);
			}
		}

		// Build body with groups
		const body: string[] = [];

		// Output defined groups in order
		for (const [key, name] of groupMap) {
			const items = groupedFlags.get(key);
			if (items && items.length > 0) {
				if (body.length > 0) {
					body.push("");
				}
				body.push(`${yc.dim(name)}`);
				for (const line of splitTable(items)) {
					body.push(`  ${line}`);
				}
			}
		}

		// Output default group last
		if (defaultFlags.length > 0) {
			if (body.length > 0) {
				body.push("");
				body.push(`${yc.dim("Other")}`);
				for (const line of splitTable(defaultFlags)) {
					body.push(`  ${line}`);
				}
			} else {
				// No groups defined, output flat
				body.push(...splitTable(defaultFlags));
			}
		}

		return body;
	}

	private renderCommandFlags() {
		const command = this._command;
		if (!command?.flags || objectIsEmpty(command.flags)) {
			return;
		}

		const body = this.renderGroupedFlags(
			command.flags,
			this._flagGroups,
			"flag",
		);

		return {
			title: "Flags",
			body,
		};
	}

	private renderGlobalFlags() {
		if (!this._globalFlags || objectIsEmpty(this._globalFlags)) {
			return;
		}

		const body = this.renderGroupedFlags(
			this._globalFlags,
			this._globalFlagGroups,
			"global flag",
		);

		return {
			title: "Global Flags",
			body,
		};
	}

	private renderNotes() {
		if (!this._notes?.length) {
			return;
		}

		return {
			title: "Notes",
			body: this._notes,
		};
	}

	private renderExamples() {
		if (!this._examples?.length) {
			return;
		}

		const items = this._examples.map(([command, description]) => {
			return [command, DELIMITER, description];
		});

		return {
			title: "Examples",
			body: splitTable(items),
		};
	}
}
