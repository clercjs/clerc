import { Clerc, defineCommandWithHandler } from "./packages/clerc/src";
import { helpPlugin } from "./packages/plugin-help/src";

const _cli = Clerc.create()
  .name("tsxt")
  .use(helpPlugin())
  .command("tmp as", "f", {
    alias: [
      "af",
    ],
    flags: {
      ab: {
        description: "adf",
        type: Number,
        default: 123,
      },
    },
    parameters: [
      "<asfd>",
    ],
  })
  .on("tmp as", (ctx) => {
    ctx.name;
    ctx.flags;
    // console.log(ctx);
  })
  // .command(CommandWithHandler)
  .parse();
