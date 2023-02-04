import textTable from "text-table";
import stringWidth from "string-width";

export const table = (items: string[][]) => textTable(items, { stringLength: stringWidth });

export const splitTable = (items: string[][]) => {
  return table(items).split("\n");
};

const primitiveMap = new Map<any, string>([
  [Boolean, ""],
  [String, "string"],
  [Number, "number"],
]);
export const stringifyType = (type: any, hasDefault = false) => {
  const res = primitiveMap.has(type)
    ? primitiveMap.get(type)
    : "value";
  return hasDefault ? `[${res}]` : `<${res}>`;
};
