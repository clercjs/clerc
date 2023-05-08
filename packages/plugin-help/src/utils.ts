import type {
  Clerc,
  Command,
  CommandType,
  Flags,
  RootType,
  TranslateFn,
} from "@clerc/core";
import { Root, formatCommandName } from "@clerc/core";
import { gracefulFlagName } from "@clerc/utils";
import stringWidth from "string-width";
import textTable from "text-table";
import * as yc from "yoctocolors";

import type { Renderers, Section } from "./renderer";

export const table = (items: string[][]) =>
  textTable(items, { stringLength: stringWidth });

export const splitTable = (items: string[][]) => table(items).split("\n");

const primitiveMap = new Map<any, string | undefined>([
  [Boolean, undefined],
  [String, "string"],
  [Number, "number"],
]);
export function stringifyType(type: any, hasDefault = false) {
  const res = primitiveMap.has(type) ? primitiveMap.get(type) : "value";

  return res ? (hasDefault ? `[${res}]` : `<${res}>`) : "";
}

export function sortName(a: CommandType, b: CommandType) {
  if (a === Root) {
    return -1;
  }
  if (b === Root) {
    return 1;
  }

  return a.length - b.length;
}

export const DELIMITER = yc.yellow("-");

export function print(s: string) {
  process.stdout.write(s);
}

export function generateCliDetail(
  sections: Section[],
  cli: Clerc,
  subcommand?: Command<string | RootType>,
) {
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
      body: yc.green(
        `${cli._scriptName} ${formatCommandName(subcommand.name)}`,
      ),
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
}

export function generateExamples(
  sections: Section[],
  examples: [string, string][],
  t: TranslateFn,
) {
  const examplesFormatted = examples.map(([command, description]) => [
    command,
    DELIMITER,
    description,
  ]);
  sections.push({
    title: t("help.examples")!,
    body: splitTable(examplesFormatted),
  });
}

export const formatFlags = (
  flags: Flags,
  t: TranslateFn,
  renderers: Required<Renderers>,
) =>
  Object.entries(flags).map(([name, flag]) => {
    const hasDefault = flag.default !== undefined;
    let flagNameWithAlias: string[] = [gracefulFlagName(name)];
    if (flag.alias) {
      flagNameWithAlias.push(gracefulFlagName(flag.alias));
    }
    flagNameWithAlias = flagNameWithAlias.map(renderers.renderFlagName);
    const items = [
      yc.blue(flagNameWithAlias.join(", ")),
      renderers.renderType(flag.type, hasDefault),
    ];
    items.push(DELIMITER, flag.description || t("help.noDescription")!);
    if (hasDefault) {
      items.push(
        `(${t("help.default", renderers.renderDefault(flag.default))!})`,
      );
    }

    return items;
  });
