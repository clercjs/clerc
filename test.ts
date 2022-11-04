import { Clerc } from "./packages/clerc";
import { helpPlugin } from "./packages/plugin-help/src/index";

const _cli = Clerc.create()
  .name("123")
  .description("test cli")
  .version("1.0.0")
  .use(helpPlugin)
  // .command("_", "123")
  .command("foo", "bar", { alias: ["f"], flags: { a: { alias: "f", description: "1" } } })
  .command("baz", "qux", { alias: ["b"], flags: { d: { alias: ["e", "c"], description: "1" } } })
  .on("baz", (ctx) => { console.log(ctx); })
  .parse();
