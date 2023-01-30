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
