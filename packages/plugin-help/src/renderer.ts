import type {
  Clerc,
  ClercFlagDefinitionValue,
  ClercFlagsDefinition,
  Command,
  CommandsMap,
} from "@clerc/core";
import {
  DOUBLE_DASH,
  extractParameterInfo,
  inferDefault,
  normalizeFlagValue,
  normalizeParameterValue,
} from "@clerc/core";
import {
  formatFlagName,
  formatVersion,
  isTruthy,
  objectIsEmpty,
  toArray,
} from "@clerc/utils";
import * as tint from "@uttr/tint";
import stringWidth from "string-width";
import textTable from "text-table";

import type { Formatters, GroupsOptions } from "./types";
import { formatCommandName, isFlagObject } from "./utils";

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
    private _examples?: [string, string][],
    private _notes?: string[],
  ) {}

  public setCommand(command: Command | undefined): void {
    if (command) {
      this._command = command;
      this._examples = command?.help?.examples;
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

        return `${tint.underline.bold(section.title)}\n${body
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
    const { _scriptName, _version, _description } = this._cli;
    const command = this._command;
    const description = command ? command.description : _description;
    const isRoot = !command || command.name === "";
    const formattedScriptName = isRoot
      ? tint.bold(_scriptName)
      : tint.dim(_scriptName);
    const formattedCommandName = command?.name
      ? ` ${tint.bold(command.name)}`
      : "";
    const formattedVersion = command ? "" : ` ${formatVersion(_version)}`;
    const headerLine = `${formattedScriptName}${formattedCommandName}${formattedVersion}`;
    const alias =
      command?.alias === undefined
        ? undefined
        : `Alias${toArray(command.alias).length > 1 ? "es" : ""}: ${toArray(
            command.alias,
          )
            .map((a) => tint.bold(formatCommandName(a)))
            .join(", ")}`;

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
        const doubleDashIndex = command.parameters.indexOf(DOUBLE_DASH);
        const hasRequiredAfterDoubleDash =
          doubleDashIndex !== -1 &&
          command.parameters.slice(doubleDashIndex + 1).some((parameter) => {
            const key =
              typeof parameter === "string" ? parameter : parameter.key;

            return key.startsWith("<");
          });
        const items = command.parameters.map((parameter) => {
          let key = typeof parameter === "string" ? parameter : parameter.key;

          // Use `parameter` here on purpose since we allow only string format for `--`
          if (parameter === DOUBLE_DASH) {
            key = hasRequiredAfterDoubleDash ? DOUBLE_DASH : `[${DOUBLE_DASH}]`;
          }

          return key;
        });
        usage += ` ${items.join(" ")}`;
      }
    } else {
      if (
        this._cli._commands.size > 0 &&
        (!this._cli._commands.has("") || this._cli._commands.size !== 1) // Not root command only case
      ) {
        usage += this._cli._commands.has("")
          ? ` ${tint.dim("[command]")}`
          : ` ${tint.dim("<command>")}`;
      }
    }

    if (
      (command?.flags && !objectIsEmpty(command.flags)) ||
      !objectIsEmpty(this._globalFlags)
    ) {
      usage += ` ${tint.dim("[flags]")}`;
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
      // Use `parameter` here on purpose since we allow only string format for `--`
      .filter((parameter) => parameter !== DOUBLE_DASH)
      .map(normalizeParameterValue)
      .map(({ key, type, description }) => {
        let formattedType: string;

        if (type) {
          formattedType = this._formatters.formatTypeValue(type);
        } else {
          const { isVariadic } = extractParameterInfo(key);
          formattedType = isVariadic ? "Array<string>" : "string";
        }

        return [tint.bold(key), tint.dim(formattedType), description].filter(
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

      const commandName = tint.bold(
        formatCommandName(command.name.slice(prefix.length)),
      );
      const aliases =
        command.alias === undefined
          ? ""
          : ` (${toArray(command.alias).map(formatCommandName).join(", ")})`;
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
        body.push(`${tint.dim(name)}`);
        body.push(...splitTable(items).map(withIndent));
      }
    }

    return body;
  }

  public renderAvailableSubcommands(parentCommandName: string): string | null {
    const subcommands = this.getSubcommands(parentCommandName);

    if (subcommands.size === 0) {
      return null;
    }

    const prefix = `${parentCommandName} `;
    const body = this.buildGroupedCommandsBody(subcommands, prefix);

    if (body.length === 0) {
      return null;
    }

    const sections: Section[] = [
      {
        body: `${this._cli._scriptName} ${tint.bold(parentCommandName)} not found`,
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

    if (body.length === 0) {
      return null;
    }

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
    const isBoolean = flag.type === Boolean;
    const isNegatable =
      isBoolean && flag.negatable !== false && flag.default === true;
    if (isNegatable) {
      flagName += `, --no-${name}`;
    }
    const type = this._formatters.formatTypeValue(flag.type);

    let defaultValue: unknown = flag.default;
    if (defaultValue === undefined) {
      defaultValue = inferDefault(flag.type);
    }
    const default_ =
      defaultValue !== undefined &&
      tint.dim(
        `[default: ${tint.bold(this._formatters.formatFlagDefault(defaultValue))}]`,
      );

    return [
      tint.bold(flagName),
      tint.dim(type),
      flag.description,
      default_,
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
      if (isFlagObject(flag) && flag.help?.show === false) {
        continue;
      }

      const group =
        // eslint-disable-next-line ts/prefer-nullish-coalescing
        (isFlagObject(flag) && flag.help?.group) || DEFAULT_GROUP_KEY;

      if (group === DEFAULT_GROUP_KEY) {
        defaultFlags.push(this.renderFlagItem(name, flag));

        continue;
      }

      validateGroup(group, groupMap, itemType, name);
      const groupItems = groupedFlags.get(group) ?? [];
      groupItems.push(this.renderFlagItem(name, flag));
      groupedFlags.set(group, groupItems);
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
        body.push(`${tint.dim(name)}`);
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

    if (body.length === 0) {
      return;
    }

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

    // Skip section if all global flags are hidden
    if (body.length === 0) {
      return;
    }

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
