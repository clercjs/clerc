import type { Clerc, Command, CommandType, Flags, RootType, TranslateFn } from "@clerc/core";
import { Root, formatCommandName } from "@clerc/core";
import { gracefulFlagName } from "@clerc/utils";
import * as yc from "yoctocolors";
import stringWidth from "string-width";
import textTable from "text-table";

import type { Section } from "./renderer";

export const table = (items: string[][]) => textTable(items, { stringLength: stringWidth });

export const splitTable = (items: string[][]) => table(items).split("\n");

const primitiveMap = new Map<any, string | undefined>([
  [Boolean, undefined],
  [String, "string"],
  [Number, "number"],
]);
export const stringifyType = (type: any, hasDefault = false) => {
  const res = primitiveMap.has(type)
    ? primitiveMap.get(type)
    : "value";
  return res
    ? hasDefault ? `[${res}]` : `<${res}>`
    : "";
};

export const sortName = (a: CommandType, b: CommandType) => {
  if (a === Root) { return -1; }
  if (b === Root) { return 1; }
  return a.length - b.length;
};

export const DELIMITER = yc.yellow("-");

export const print = (s: string) => {
  process.stdout.write(s);
};

export const generateCliDetail = (sections: Section[], cli: Clerc, subcommand?: Command<string | RootType>) => {
  const { t } = cli.i18n;
  const items = [
    {
      title: t("help.name")!,
      body: yc.red(cli._name),
    },
    {
      title: t("help.version")!,
      body: yc.yellow(cli._version),
    },
  ];
  if (subcommand) {
    items.push({
      title: t("help.subcommand")!,
      body: yc.green(`${cli._name} ${formatCommandName(subcommand.name)}`),
    });
  }
  sections.push({
    type: "inline",
    items,
  });
  sections.push({
    title: t("help.description")!,
    body: [subcommand?.description ?? cli._description],
  });
};

export const generateExamples = (sections: Section[], examples: [string, string][], t: TranslateFn) => {
  const examplesFormatted = examples.map(([command, description]) => [command, DELIMITER, description]);
  sections.push({
    title: t("help.examples")!,
    body: splitTable(examplesFormatted),
  });
};

export const formatFlags = (flags: Flags) =>
  Object.entries(flags).map(([name, flag]) => {
    const flagNameWithAlias = [gracefulFlagName(name)];
    if (flag.alias) {
      flagNameWithAlias.push(gracefulFlagName(flag.alias));
    }
    const items = [yc.blue(flagNameWithAlias.join(", "))];
    items.push(DELIMITER, flag.description);
    if (flag.type) {
      const type = stringifyType(flag.type);
      type && items.push(yc.gray(`(${type})`));
    }
    return items;
  });
