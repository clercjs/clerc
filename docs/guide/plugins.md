---
title: Plugins
---

# Plugins

A plugin is a function that can accept a `Clerc` instance and extend it.

:::info

The plugin system allows you to add rich functionality according to your needs.

:::

## Usage

```ts
import { definePlugin } from "clerc";

const plugin = definePlugin({
	setup: (cli) =>
		cli.command("foo", "A foo command").on("foo", (ctx) => {
			console.log("It works!");
		}),
});

const cli = Cli()
	.scriptName("foo-cli")
	.description("A simple CLI")
	.version("1.0.0")
	.use(plugin)
	.parse();
```

## Development

In the `setup` function, you can directly get the `Clerc` instance and perform various configurations and extensions on it, such as adding commands, event listeners, etc.

```ts
import { definePlugin } from "clerc";

export const myPlugin = definePlugin({
	setup: (cli) => {
		// Extend the cli here
		return cli.command("bar", "A bar command").on("bar", (ctx) => {
			console.log("Bar command executed!");
		});
	},
});
```

## Extending Custom Option Types

If your plugin needs to add custom types for commands, flags or parameters, you can use the following method:

```ts
declare module "@clerc/core" {
	// For adding custom types to commands
	export interface CommandCustomOptions {
		foo: string;
	}

	// For adding custom types to options
	export interface FlagCustomOptions {
		foo: string;
	}

	// For adding custom types to parameters
	export interface ParameterCustomOptions {
		foo: string;
	}
}
```

## Publishing Plugins

While not mandatory, it is recommended that you follow the following conventions when publishing plugins to make it easier for users to identify and use your plugins:

- Use `clerc-plugin-<name>` as the package name.
- Add the keyword `clerc-plugin` in `package.json`.
