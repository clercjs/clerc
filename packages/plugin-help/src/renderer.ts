import * as colors from "colorette";
import { table } from "./utils";

export interface BlockSection {
  type?: "block"
  title: string
  body: string[]
}

export interface InlineSection {
  type: "inline"
  items: {
    title: string
    body: string
  }[]
}

export type Section = BlockSection | InlineSection;

export const render = (sections: Section[]) => {
  const rendered = [] as string[];
  for (const section of sections) {
    if (section.type === "block" || !section.type) {
      const indent = " ".repeat(4);
      const formattedBody = section.body
        .map(line => indent + line);
      formattedBody.unshift("");
      const body = formattedBody.join("\n");
      rendered.push(table([colors.bold(section.title)], [body]).toString());
    } else if (section.type === "inline") {
      const formattedBody = section.items
        .map(item => [colors.bold(item.title), item.body]);
      const tableGenerated = table(...formattedBody);
      rendered.push(tableGenerated.toString());
    }
    rendered.push("");
  }
  return rendered.join("\n");
};
