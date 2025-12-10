import type { Clerc, ClercFlagsDefinition, Command } from "@clerc/core";
import {
	formatFlagName,
	formatVersion,
	isTruthy,
	objectIsEmpty,
} from "@clerc/utils";
import stringWidth from "string-width";
import textTable from "text-table";
import * as yc from "yoctocolors";

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

export class HelpRenderer {
	constructor(
		private _cli: Clerc,
		private _globalFlags: ClercFlagsDefinition,
		private _command?: Command,
		private _notes?: string[],
		private _examples?: [string, string][],
	) {}

	public render() {
		const sections: Section[] = [
			this.renderHeader(),
			this.renderUsage(),
			this.renderCommands(),
			this.renderCommandFlags(),
			this.renderGlobalFlags(),
			this.renderNotes(),
			this.renderExamples(),
		];

		return sections
			.filter(isTruthy)
			.filter((section) => section.body.length > 0)
			.map((section) => {
				const body = Array.isArray(section.body)
					? section.body.filter(Boolean).join("\n")
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
		const headerLine = command
			? `${yc.green(_name)} ${yc.cyan(command.name)}`
			: `${yc.green(_name)} ${yc.yellow(formatVersion(_version))}`;

		return {
			body: [
				`${headerLine}${description ? ` ${DELIMITER} ${description}` : ""}`,
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
		}
		// else {
		// 	usage += " [command]";
		// }

		if (
			(command?.flags && !objectIsEmpty(command.flags)) ||
			!objectIsEmpty(this._globalFlags)
		) {
			usage += " [FLAGS]";
		}

		return {
			title: "Usage",
			body: [usage],
		};
	}

	private renderCommands() {
		const commands = this._cli._commands;
		if (this._command || commands.size === 0) {
			return;
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
		if (!command?.flags || objectIsEmpty(command.flags)) {
			return;
		}

		const items = this.renderFlags(command.flags);

		return {
			title: "Flags",
			body: splitTable(items),
		};
	}

	private renderGlobalFlags() {
		if (!this._globalFlags || objectIsEmpty(this._globalFlags)) {
			return;
		}

		const items = this.renderFlags(this._globalFlags);

		return {
			title: "Global Flags",
			body: splitTable(items),
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
