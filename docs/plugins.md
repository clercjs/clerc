# Plugins

A plugin is a function that accepts a `Clerc` instance and returns a `Clerc` instance.

> Note: the return value is not required technically, but it is recommended to return the `Clerc` instance for better type inference.

## Usage

```ts
import { Clerc, definePlugin } from "clerc";

const plugin = definePlugin({
  setup: (cli) =>
    cli.command("foo", "A foo command").on("foo", (ctx) => {
      console.log("It works!");
    }),
});

const cli = Clerc.create()
  .scriptName("foo-cli")
  .description("A simple cli")
  .version("1.0.0")
  .use(plugin)
  .parse();
```
