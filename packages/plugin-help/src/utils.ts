import { Root } from "@clerc/core";
import type { CommandType } from "@clerc/core";
import getFuncName from "get-func-name";
import textTable from "text-table";
import stringWidth from "string-width";

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
