import { execaSync } from "execa";
import { Clerc, Root, defineCommand, friendlyErrorPlugin, helpPlugin, notFoundPlugin, strictFlagsPlugin, versionPlugin } from "./packages/clerc/src/index";
// import { OneOf } from "./packages/flag-types";

const cli = Clerc.create("puild", "A build tool based on vite.", "0.26.2")
  .use(helpPlugin())
  .use(friendlyErrorPlugin())
  .use(notFoundPlugin())
  .use(versionPlugin())
  .use(strictFlagsPlugin())
  .command(Root, "afd", {
    alias: "asf",
    parameters: [
      "<param adfaf>",
      "--",
      "[p]",
    ],
    flags: {
      aadd: {
        type: Boolean,
        default: false,
      },
      bb: {
        type: String,
        default: "",
        description: "sdfsaf",
      },
    },
    // help: {
    //   render: (sections) => {
    //     sections.push({
    //       type: "inline",
    //       items: [
    //         {
    //           title: "Foooo",
    //           body: "asffsf",
    //         },
    //       ],
    //     });
    //     sections.push({
    //       type: "inline",
    //       items: [
    //         {
    //           title: "Node.js help",
    //           body: `\n\n${execaSync("node", ["-h"]).stdout}`,
    //         },
    //       ],
    //     });
    //     return sections;
    //   },
    // },
  })
  .on(Root, async (ctx) => {})
  // .parse({ run: false });
  .runMatchedCommand();
