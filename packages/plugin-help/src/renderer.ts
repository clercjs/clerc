import pc from "picocolors";
import boxen from "boxen";

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
export type Render = (sections: Section[]) => string;

export const renderCliffy: Render = (sections: Section[]) => {
  const rendered = [] as string[];
  for (const section of sections) {
    if (section.type === "block" || !section.type) {
      const indent = "    ";
      const formattedBody = section.body
        .map(line => indent + line);
      formattedBody.unshift("");
      const body = formattedBody.join("\n");
      rendered.push(table([pc.bold(`${section.title}:`)], [body]).toString());
    } else if (section.type === "inline") {
      const formattedBody = section.items
        .map(item => [pc.bold(item.title), item.body]);
      const tableGenerated = table(...formattedBody);
      rendered.push(tableGenerated.toString());
    }
    rendered.push("");
  }
  return rendered.join("\n");
};

export const renderTyper: Render = (sections: Section[]) => {
  const rendered = [] as string[];
  for (const section of sections) {
    if (section.type === "block" || !section.type) {
      rendered.push(boxen(section.body.join("\n\n"), {
        title: section.title,
        borderStyle: "round",
        padding: 0.5,
      }));
    } else if (section.type === "inline") {
      const formattedBody = section.items
        .map(item => [pc.bold(item.title), item.body]);
      const tableGenerated = table(...formattedBody);
      rendered.push(tableGenerated.toString());
    }
    rendered.push("");
  }
  return rendered.join("\n");
};
