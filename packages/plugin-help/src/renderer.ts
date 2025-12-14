import type {
	Clerc,
	ClercFlagDefinitionValue,
	ClercFlagsDefinition,
	Command,
	CommandsMap,
} from "@clerc/core";
import { DOUBLE_DASH, normalizeFlagValue } from "@clerc/core";
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
import { formatCommandName } from "./utils";

const DEFAULT_GROUP_KEY = "default";

const table = (items: string[][]) =>
	textTable(items, { stringLength: stringWidth });

const splitTable = (items: string[][]) => table(items).split("\n");

const DELIMITER = "-";
const INDENT = " ".repeat(2);

const withIndent = (str: string): string => `${INDENT}${str}`;

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
	private _command: Command | undefined;

	private get _commandGroups() {
		return groupDefinitionsToMap(this._getGroups().commands);
	}

	private get _flagGroups() {
		return groupDefinitionsToMap(this._getGroups().flags);
	}

	private get _globalFlagGroups() {
		return groupDefinitionsToMap(this._getGroups().globalFlags);
	}

	constructor(
		private _formatters: Formatters,
		private _cli: Clerc,
		private _globalFlags: ClercFlagsDefinition,
		private _getGroups: () => GroupsOptions,
		private _getExamples: () => [string, string][] | undefined,
		private _notes?: string[],
	) {}

	public setCommand(command: Command | undefined): void {
		if (command) {
			this._command = command;
			this._getExamples = () => command?.help?.examples;
			this._notes = command?.help?.notes;
		}
	}

	private renderSections(sections: Section[]): string {
		return sections
			.filter(isTruthy)
			.map((section) => {
				const body = Array.isArray(section.body)
					? section.body.filter((s) => s !== undefined).join("\n")
					: section.body;

				if (!section.title) {
					return body;
				}

				return `${yc.underline(yc.bold(section.title))}\n${body
					.split("\n")
					.map(withIndent)
					.join("\n")}`;
			})
			.join("\n\n");
	}

	public render(): string {
		const sections: Section[] = [
			this.renderHeader(),
			this.renderUsage(),
			this.renderParameters(),
			this.renderCommandFlags(),
			this.renderGlobalFlags(),
			this.renderCommands(),
			this.renderExamples(),
			this.renderNotes(),
		];

		return this.renderSections(sections);
	}

	private renderHeader() {
		const { _name, _version, _description } = this._cli;
		const command = this._command;
		const description = command ? command.description : _description;
		const formattedCommandName = command?.name
			? ` ${yc.bold(command.name)}`
			: "";
		const headerLine = command
			? `${yc.dim(_name)}${formattedCommandName}`
			: `${yc.bold(_name)} ${formatVersion(_version)}`;
		const alias = command?.alias
			? `Alias${toArray(command.alias).length > 1 ? "es" : ""}: ${toArray(
					command.alias,
				)
					.map((a) => yc.bold(a))
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
				usage += ` ${command.parameters.map((p) => (typeof p === "string" ? p : p.key)).join(" ")}`;
			}
		} else {
			if (
				this._cli._commands.size > 0 &&
				!(this._cli._commands.has("") && this._cli._commands.size === 1) // Not root command only case
			) {
				usage += this._cli._commands.has("")
					? ` ${yc.dim("[command]")}`
					: ` ${yc.dim("<command>")}`;
			}
		}

		if (
			(command?.flags && !objectIsEmpty(command.flags)) ||
			!objectIsEmpty(this._globalFlags)
		) {
			usage += ` ${yc.dim("[flags]")}`;
		}

		return {
			title: "Usage",
			body: [usage],
		};
	}

	private renderParameters() {
		const command = this._command;
		if (!command?.parameters || command.parameters.length === 0) {
			return;
		}

		const items = command.parameters
			.filter((p) => p !== DOUBLE_DASH)
			.map((parameter) => {
				const key = typeof parameter === "string" ? parameter : parameter.key;
				const type = typeof parameter === "string" ? undefined : parameter.type;
				const formattedType = type
					? this._formatters.formatTypeValue(type)
					: "string";
				const description =
					typeof parameter === "string" ? undefined : parameter.description;

				return [yc.bold(key), yc.dim(formattedType), description].filter(
					isTruthy,
				);
			});

		return {
			title: "Parameters",
			body: splitTable(items),
		};
	}

	private getSubcommands(parentCommandName: string): CommandsMap {
		const subcommands = new Map<string, Command>();

		if (parentCommandName === "") {
			return subcommands;
		}

		const prefix = `${parentCommandName} `;

		for (const [name, command] of this._cli._commands) {
			if (name.startsWith(prefix)) {
				const subcommandName = name.slice(prefix.length);
				subcommands.set(subcommandName, command);
			}
		}

		return subcommands;
	}

	private buildGroupedCommandsBody(
		commandsToShow: CommandsMap,
		prefix: string,
	): string[] {
		const groupedCommands = new Map<string, string[][]>();
		const defaultCommands: string[][] = [];
		let rootCommand: string[] = [];

		for (const command of commandsToShow.values()) {
			if ((command as any).__isAlias || command.help?.show === false) {
				continue;
			}

			const group = command.help?.group;
			validateGroup(group, this._commandGroups, "command", command.name);

			const commandName = yc.bold(
				formatCommandName(command.name.slice(prefix.length)),
			);
			const aliases = command.alias
				? ` (${toArray(command.alias).join(", ")})`
				: "";
			const item = [`${commandName}${aliases}`, command.description].filter(
				isTruthy,
			);

			if (command.name === "") {
				rootCommand = item;
			} else if (group && group !== DEFAULT_GROUP_KEY) {
				const groupItems = groupedCommands.get(group) ?? [];
				groupItems.push(item);
				groupedCommands.set(group, groupItems);
			} else {
				defaultCommands.push(item);
			}
		}

		const body: string[] = [];

		const defaultGroup: string[][] = [];

		// Output root command first
		if (rootCommand.length > 0) {
			defaultGroup.push(rootCommand);
		}

		if (defaultCommands.length > 0) {
			defaultGroup.push(...defaultCommands);
		}

		if (defaultGroup.length > 0) {
			body.push(...splitTable(defaultGroup));
		}

		// Output defined groups in order
		for (const [key, name] of this._commandGroups) {
			const items = groupedCommands.get(key);
			if (items && items.length > 0) {
				if (body.length > 0) {
					body.push("");
				}
				body.push(`${yc.dim(name)}`);
				body.push(...splitTable(items).map(withIndent));
			}
		}

		return body;
	}

	public renderAvailableSubcommands(parentCommandName: string): string {
		const subcommands = this.getSubcommands(parentCommandName);

		if (subcommands.size === 0) {
			return "";
		}

		const prefix = `${parentCommandName} `;
		const body = this.buildGroupedCommandsBody(subcommands, prefix);

		if (body.length === 0) {
			return "";
		}

		const sections: Section[] = [
			{
				body: `${this._cli._name} ${yc.bold(parentCommandName)} not found`,
			},
			{
				title: "Available Subcommands",
				body,
			},
		];

		return this.renderSections(sections);
	}

	private renderCommands() {
		const commands = this._cli._commands;

		// If a command is selected, show its subcommands
		let commandsToShow: CommandsMap;
		let title = "Commands";
		let prefix = "";

		if (this._command) {
			prefix = this._command.name ? `${this._command.name} ` : "";
			title = "Subcommands";
			commandsToShow = this.getSubcommands(this._command.name);

			if (commandsToShow.size === 0) {
				return;
			}
		} else {
			commandsToShow = commands;
		}

		if (commandsToShow.size === 0) {
			return;
		}

		const body = this.buildGroupedCommandsBody(commandsToShow, prefix);

		return {
			title,
			body,
		};
	}

	private renderFlagItem(name: string, flag: ClercFlagDefinitionValue) {
		flag = normalizeFlagValue(flag);
		let flagName = formatFlagName(name);
		if (flag.short) {
			flagName += `, ${formatFlagName(flag.short)}`;
		}
		const type = this._formatters.formatTypeValue(flag.type);
		const default_ =
			flag.default !== undefined &&
			yc.dim(
				`[default: ${yc.bold(this._formatters.formatFlagDefault(flag.default))}]`,
			);

		return [yc.bold(flagName), yc.dim(type), flag.description, default_].filter(
			isTruthy,
		);
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

		// Output default group first (without title)
		if (defaultFlags.length > 0) {
			body.push(...splitTable(defaultFlags));
		}

		// Output defined groups in order
		for (const [key, name] of groupMap) {
			const items = groupedFlags.get(key);
			if (items && items.length > 0) {
				if (body.length > 0) {
					body.push("");
				}
				body.push(`${yc.dim(name)}`);
				body.push(...splitTable(items).map(withIndent));
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
		const examples = this._getExamples();
		if (!examples?.length) {
			return;
		}

		const items = examples.map(([command, description]) => {
			return [command, DELIMITER, description];
		});

		return {
			title: "Examples",
			body: splitTable(items),
		};
	}
}
