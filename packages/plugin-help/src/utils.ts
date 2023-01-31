import textTable from "text-table";

export const table = (...items: string[][]) => textTable(items);

export const splitTable = (...items: string[][]) => {
  return table(...items).toString().split("\n");
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
