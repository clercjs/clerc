import { Cli } from "clerc";

await Cli({
  scriptName: "foo-cli",
  description: "A foo CLI",
  version: "0.0.0",
})
  .command("bar", {
    description: "A bar command",
    run: (ctx) => {
      ctx.log.success("Hello, world from Clerc v2!");
    },
  })
  .runMain();
