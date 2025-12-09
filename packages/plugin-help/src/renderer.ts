import type { Clerc, ClercFlagsDefinition, Command } from "@clerc/core";
import { formatFlagName, formatVersion } from "@clerc/utils";
import stringWidth from "string-width";
import textTable from "text-table";
import * as yc from "yoctocolors";

export const table = (items: string[][]) =>
	textTable(items, { stringLength: stringWidth });

export const splitTable = (items: string[][]) => table(items).split("\n");

export interface Section {
	title: string;
	body: string | (string | undefined)[];
}

export class HelpRenderer {
	constructor(
		private _cli: Clerc,
		private _command?: Command,
		private _globalFlags?: ClercFlagsDefinition,
	) {}

	public render() {
		const sections: Section[] = [
			this.renderHeader(),
			this.renderUsage(),
			this.renderCommands(),
			this.renderCommandFlags(),
			this.renderGlobalFlags(),
		];

		return sections
			.filter((section) => section.body.length > 0)
			.map((section) => {
				const body = Array.isArray(section.body)
					? section.body.filter(Boolean).join("\n")
					: section.body;

				return `${yc.bold(section.title)}\n${body
					.split("\n")
					.map((line) => `  ${line}`)
					.join("\n")}`;
			})
			.join("\n\n");
	}

	private renderHeader() {
		const { _name, _version } = this._cli;
		const command = this._command;

		return {
			title: "Description",
			body: [
				`${yc.green(_name)} ${yc.yellow(formatVersion(_version))}`,
				command?.description,
			],
		};
	}

	private renderUsage() {
		const { _scriptName } = this._cli;
		const command = this._command;

		let usage = `$ ${_scriptName}`;

		if (command) {
			usage += ` ${command.name}`;
			if (command.parameters) {
				usage += ` ${command.parameters.join(" ")}`;
			}
		} else {
			usage += " [command]";
		}

		if (command?.flags || this._globalFlags) {
			usage += " [flags]";
		}

		return {
			title: "Usage",
			body: [usage],
		};
	}

	private renderCommands() {
		const commands = this._cli._commands;
		if (this._command || commands.size === 0) {
			return {
				title: "Commands",
				body: [],
			};
		}

		const items = [...commands.values()].map((command) => {
			return [yc.cyan(command.name), command.description];
		});

		return {
			title: "Commands",
			body: splitTable(items),
		};
	}

	private renderFlags(flags: ClercFlagsDefinition) {
		return Object.entries(flags).map(([name, flag]) => {
			const flagName = formatFlagName(name);
			const aliases = (
				Array.isArray(flag.alias) ? flag.alias : flag.alias ? [flag.alias] : []
			)
				.map(formatFlagName)
				.join(", ");
			const description = flag.description ?? "";
			const type = (flag.type as any).name ?? (flag.type as any).toString();
			const defaultValue =
				flag.default === undefined ? "" : `[default: ${String(flag.default)}]`;

			return [
				yc.blue([flagName, aliases].filter(Boolean).join(", ")),
				yc.gray(type),
				description,
				yc.gray(defaultValue),
			];
		});
	}

	private renderCommandFlags() {
		const command = this._command;
		if (!command?.flags) {
			return {
				title: "Flags",
				body: [],
			};
		}

		const items = this.renderFlags(command.flags);

		return {
			title: "Flags",
			body: splitTable(items),
		};
	}

	private renderGlobalFlags() {
		if (!this._globalFlags) {
			return {
				title: "Global Flags",
				body: [],
			};
		}

		const items = this.renderFlags(this._globalFlags);

		return {
			title: "Global Flags",
			body: splitTable(items),
		};
	}
}
