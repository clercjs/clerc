---
title: Parameters
---

# Parameters

Parameters (also known as _positional arguments_) are names that correspond to argument values. Think of parameters as variable names and argument values as values associated with variables.

This guide covers parameter definitions, types, and descriptions.

## Basic Parameter Definition

You can define parameters in the `parameters` array property to access specific arguments by name. Parameters can be defined in the following formats:

- **Required parameters** are denoted by angle brackets (e.g., `<parameter name>`).
- **Optional parameters** are denoted by square brackets (e.g., `[parameter name]`).
- **Spread parameters** are denoted by the `...` suffix (e.g., `<parameter name...>` or `[parameter name...]`).

Note that required parameters **cannot come after optional parameters**, and spread parameters must be placed last.

Parameters can be accessed using camelCase notation on the `ctx.parameters` property.

Example:

```ts
// $ node ./foo-cli.mjs a b c d

const cli = Cli()
  .scriptName("foo-cli")
  .description("A simple CLI")
  .version("1.0.0")
  .command("foo", "A foo command", {
    parameters: [
      "<required parameter>",
      "[optional parameter]",
      "[optional spread...]",
    ],
  })
  .on("foo", (ctx) => {
    ctx.parameters;
    //  ^?
    ctx.parameters.requiredParameter; // => "a"
    ctx.parameters.optionalParameter; // => "b"
    ctx.parameters.optionalSpread; // => ["c", "d"]
  })
  .parse();
```

## Parameter Objects

For more advanced parameter configuration, you can use parameter objects instead of simple strings. Parameter objects allow you to:

- Add a type to validate and convert parameter values
- Add a description for documentation and help output

### Basic Parameter Object

```ts
const cli = Cli()
  .scriptName("config-cli")
  .description("Configuration tool")
  .version("1.0.0")
  .command("set", "Set a configuration value", {
    parameters: [
      {
        key: "<key>",
        description: "Configuration key name",
      },
      {
        key: "<value>",
        description: "Configuration value",
        type: String,
      },
    ],
  })
  .on("set", (ctx) => {
    console.log(`Setting ${ctx.parameters.key} to ${ctx.parameters.value}`);
  })
  .parse();
```

## Parameter Types

Parameter types allow you to validate, convert, and parse parameter values, and provide valid options in help documentation. Parameter types use the same functions as [flag types](./types), meaning you can share the same type definitions between parameters and flags. When a type is specified for a parameter, the parsed value will be automatically converted to the type.

By default, the parameter type is `String`.

For comprehensive information about all available types, see the [Types](./types) guide.

## End-of-File

The end-of-file (`--`) (also known as _flag terminator_) allows users to pass a portion of arguments. This is useful for arguments that should be parsed separately from other arguments or arguments that look like flags.

An example is [`npm run`](https://docs.npmjs.com/cli/v8/commands/npm-run-script):

```sh
$ npm run <script> -- <script arguments>
```

The `--` indicates that all arguments after it should be passed to the _script_ rather than _npm_.

You can specify `--` in the `parameters` array to parse flag terminator arguments.

:::warning

You can only define one `--` parameter in the `parameters` array. If multiple `--` parameters are defined, only the first one will be considered, and the rest will be ignored.

You can only define `--` in string format; defining it as a parameter object will not work.

:::

Example:

```ts
// $ node ./foo-cli.mjs echo -- hello world

const cli = Cli()
  .scriptName("foo-cli")
  .description("A simple CLI")
  .version("1.0.0")
  .command("echo", "Echo", {
    parameters: ["<script>", "--", "[arguments...]"],
  })
  .on("echo", (ctx) => {
    ctx.parameters;
    //  ^?
    ctx.parameters.script; // => "echo"
    ctx.parameters.arguments; // => ["hello", "world"]
  })
  .parse();
```
