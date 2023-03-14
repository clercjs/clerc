import { Clerc, helpPlugin } from "./packages/clerc/src/index";

Clerc.create("1", "1", "1")
  .use(helpPlugin())
  .command("a a", "a", {
    flags: {
      aa: {
        type: Boolean,
        description: "",
      },
    },
  })
  .flag("hel", "1", {
    type: Boolean,
  })
  .on("a a", (ctx) => {
    console.log(ctx.flags.b);
  })
  .inspector((ctx, next) => {
    next();
    return () => {
      console.log(ctx.flags);
    };
  })
  .parse();
