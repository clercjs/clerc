import getFuncName from "get-func-name";
import textTable from "text-table";

export const table = (...items: string[][]) => textTable(items);

export const splitTable = (...items: string[][]) => {
  return table(...items).toString().split("\n");
};

export const stringifyType = (type: any) => {
  return Array.isArray(type)
    ? `Array<${getFuncName(type[0])}>`
    : getFuncName(type);
};
