import pc from "picocolors";
import { Root, formatCommandName } from "@clerc/core";
import type { Clerc, Command, CommandType, Flags, RootType, TranslateFn } from "@clerc/core";
import getFuncName from "get-func-name";
import textTable from "text-table";
import stringWidth from "string-width";
import { gracefulFlagName } from "@clerc/utils";
import type { Section } from "./renderer";

export const table = (...items: string[][]) => textTable(items, { stringLength: stringWidth });

export const splitTable = (...items: string[][]) => {
  return table(...items).split("\n");
};

export const stringifyType = (type: any) => {
  return Array.isArray(type)
    ? `Array<${getFuncName(type[0])}>`
    : getFuncName(type);
};

export const sortName = (a: CommandType, b: CommandType) => {
  if (a === Root) { return -1; }
  if (b === Root) { return 1; }
  return a.length - b.length;
};

export const DELIMITER = pc.yellow("-");

export const print = (s: string) => { process.stdout.write(s); };

export const generateCliDetail = (sections: Section[], cli: Clerc, subcommand?: Command<string | RootType>) => {
  const { t } = cli.i18n;
  const items = [
    {
      title: t("help.name")!,
      body: pc.red(cli._name),
    },
    {
      title: t("help.version")!,
      body: pc.yellow(cli._version),
    },
  ];
  if (subcommand) {
    items.push({
      title: t("help.subcommand")!,
      body: pc.green(`${cli._name} ${formatCommandName(subcommand.name)}`),
    });
  }
  sections.push({
    type: "inline",
    items,
  });
  sections.push({
    title: t("help.description")!,
    body: [subcommand?.description || cli._description],
  });
};

export const generateExamples = (sections: Section[], examples: [string, string][], t: TranslateFn) => {
  const examplesFormatted = examples.map(([command, description]) => [command, DELIMITER, description]);
  sections.push({
    title: t("help.examples")!,
    body: splitTable(...examplesFormatted),
  });
};

export const formatFlags = (flags: Flags) => Object.entries(flags).map(([name, flag]) => {
  const flagNameWithAlias = [gracefulFlagName(name)];
  if (flag.alias) {
    flagNameWithAlias.push(gracefulFlagName(flag.alias));
  }
  const items = [pc.blue(flagNameWithAlias.join(", "))];
  items.push(DELIMITER, flag.description);
  if (flag.type) {
    const type = stringifyType(flag.type);
    items.push(pc.gray(`(${type})`));
  }
  return items;
});
