import { clerc } from "clerc";

const cli = clerc({
  name: "foo-cli",
  version: "0.0.0",
  description: "A foo CLI",
});

cli.command("bar [name]", {
  description: "A bar command",
  run(ctx) {
    ctx.terminal.stdout(`Hello, ${ctx.args.name ?? "world"} from Clerc v2!`);
  },
});

await cli.runMain();
