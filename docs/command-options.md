# Command Options

We created a command called "foo" and its description is "foo command" in [Getting Started](./getting-started.md). And we use `on()` to register a command handler. Now we are going to learn how to add options to the command.

Options are passed as the third argument in `command(name, description, options?)`.

## Aliases

You can add an alias for your command:

```js
import { Clerc } from "clerc";

const cli = Clerc.create()
  .name("foo-cli")
  .description("A simple cli")
  .version("1.0.0")
  .command("foo", "A foo command", {
    alias: "bar",
  })
  .on("foo", (ctx) => {
    console.log("It works!");
  })
  .parse();
```

Now both `foo-cli foo` and `foo-cli bar` will log "It works!".

You can add more aliases:

```js
import { Clerc } from "clerc";

const cli = Clerc.create()
  .name("foo-cli")
  .description("A simple cli")
  .version("1.0.0")
  .command("foo", "A foo command", {
    alias: ["bar", "baz"],
  })
  .on("foo", (ctx) => {
    console.log("It works!");
  })
  .parse();
```

## Parameters

### Common

<!-- Copied from cleye :) -->

Parameters (aka _positional arguments_) are the names that map against argument values. Think of parameters as variable names and arguments as values associated with the variables.

Parameters can be defined in the `parameters` array-property to make specific arguments accessible by name. This is useful for writing more readable code, enforcing validation, and generating help documentation.

Parameters are defined in the following formats:
- **Required parameters** are indicated by angle brackets (eg. `<parameter name>`).
- **Optional parameters** are indicated by square brackets (eg. `[parameter name]`).
- **Spread parameters** are indicated by `...` suffix (eg. `<parameter name...>` or `[parameter name...]`).

Note, required parameters cannot come after optional parameters, and spread parameters must be last.

Parameters can be accessed in camelCase on the `ctx.parameters` property.

Example:

```ts
// $ node ./foo-cli.mjs a b c d
import { Clerc } from "clerc";

const cli = Clerc.create()
  .name("foo-cli")
  .description("A simple cli")
  .version("1.0.0")
  .command("foo", "A foo command", {
    parameters: [
      "<required parameter>",
      "[optional parameter]",
      "[optional spread...]",
    ],
  })
  .on("foo", (ctx) => {
    ctx.parameters.requiredParameter; // => "a" (string)
    ctx.parameters.optionalParameter; // => "b" (string | undefined)
    ctx.parameters.optionalSpread; // => ["c", "d"] (string[])
  })
  .parse();
```

### End-of-flags
End-of-flags (`--`) (aka _end-of-options_) allows users to pass in a subset of arguments. This is useful for passing in arguments that should be parsed separately from the rest of the arguments or passing in arguments that look like flags.

An example of this is [`npm run`](https://docs.npmjs.com/cli/v8/commands/npm-run-script):
```sh
$ npm run <script> -- <script arguments>
```
The `--` indicates that all arguments afterwards should be passed into the _script_ rather than _npm_.

All end-of-flag arguments will be accessible from `ctx.flags._['--']`.

Additionally, you can specify `--` in the `parameters` array to parse end-of-flags arguments.

Example:

```ts
const argv = cli({
  name: "npm-run",
  parameters: [
    "<script>",
    "--",
    "[arguments...]",
  ],
});

// $ npm-run echo -- hello world

argv._.script; // => "echo" (string)
argv._.arguments; // => ["hello", "world] (string[])
```