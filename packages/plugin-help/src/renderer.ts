import * as yc from "yoctocolors";

import { stringifyType, table } from "./utils";

export interface BlockSection {
  type?: "block";
  title: string;
  body: string[];
}

export interface InlineSection {
  type: "inline";
  items: {
    title: string;
    body: string;
  }[];
}

export type Section = BlockSection | InlineSection;
export type Render = (sections: Section[]) => string;
export interface Renderers {
  renderSections?: (sections: Section[]) => Section[];
  renderFlagName?: (name: string) => string;
  renderType?: (type: any, hasDefault: boolean) => string;
  renderDefault?: (default_: any) => string;
}

export const render: Render = (sections: Section[]) => {
  const rendered = [] as string[];
  for (const section of sections) {
    if (section.type === "block" || !section.type) {
      const indent = "    ";
      const formattedBody = section.body
        .map(line => indent + line);
      formattedBody.unshift("");
      const body = formattedBody.join("\n");
      rendered.push(table([[yc.bold(`${section.title}`)], [body]]).toString());
    } else if (section.type === "inline") {
      const formattedBody = section.items
        .map(item => [yc.bold(`${item.title}`), item.body]);
      const tableGenerated = table(formattedBody);
      rendered.push(tableGenerated.toString());
    }
    rendered.push("");
  }
  return rendered.join("\n");
};

const noop = (x: any) => x;

export const defaultRenderers: Required<Renderers> = {
  renderFlagName: noop,
  renderSections: noop,
  renderType: stringifyType,
  renderDefault: JSON.stringify,
};
