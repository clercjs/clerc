import { cli, command } from "clerc";

const app = cli({
  name: "foo-cli",
  version: "0.0.0",
  description: "A foo CLI",
  commands: [
    command("bar [name]", {
      description: "A bar command",
      run(ctx) {
        ctx.terminal.stdout(
          `Hello, ${ctx.args.name ?? "world"} from Clerc v2!`,
        );
      },
    }),
  ],
});

await app.runMain();
