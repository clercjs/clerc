import { Clerc, friendlyErrorPlugin, helpPlugin, notFoundPlugin, strictFlagsPlugin, versionPlugin } from "./packages/clerc/dist/index.js";

const cli = Clerc.create("puild", "A build tool based on vite.", "0.26.2")
  .use(helpPlugin())
  .use(friendlyErrorPlugin())
  .use(versionPlugin())
  .use(notFoundPlugin())
  .use(strictFlagsPlugin())
  .command("a a", "afd", {
    alias: "asf",
    parameters: ["[param]", "--", "[p2]"],
    flags: {
      aa: {
        type: String,
        default: "",
      },
      bb: {
        type: String,
        default: "",
        description: "sdfsaf",
      },
    },
  })
  .on("a a", (ctx) => {
    console.log(ctx.raw._["--"]);
  })
  .parse();
