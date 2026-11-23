import { Cli } from "clerc";

const cli = Cli({
  scriptName: "foo-cli",
  version: "0.0.0",
  description: "A foo CLI",
});

cli.command("bar [name]", {
  description: "A bar command",
  run(ctx) {
    ctx.log.success(`Hello, ${ctx.args.name ?? "world"} from Clerc v2!`);
  },
});

await cli.runMain();
