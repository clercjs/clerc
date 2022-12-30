import { Table } from "@clerc/toolkit";

export const table = (...items: string[][]) => {
  const table = new Table({
    chars: {
      "top": "",
      "top-mid": "",
      "top-left": "",
      "top-right": "",
      "bottom": "",
      "bottom-mid": "",
      "bottom-left": "",
      "bottom-right": "",
      "left": "",
      "left-mid": "",
      "mid": "",
      "mid-mid": "",
      "right": "",
      "right-mid": "",
      "middle": " ",
    },
    style: { "padding-left": 0, "padding-right": 0 },
  });
  table.push(...items);
  return table;
};

export const splitTable = (...items: string[][]) => {
  return table(...items).toString().split("\n");
};
