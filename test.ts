import { Clerc } from "./packages/clerc/src";
import { completionsPlugin } from "./packages/plugin-completions/src";
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
        default: "",
      },
    },
    parameters: [
      "<asfd>",
    ],
  })

  .on("tmp", (_ctx) => {
    // console.log(ctx);
  })
  // .command(CommandWithHandler)
  .parse();
