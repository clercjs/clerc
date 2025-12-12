---
title: Help Plugin
---

# @clerc/plugin-help

A plugin that adds help information to your CLI.

:::tip

This plugin is built into the `Clerc` class exported by the `clerc` package, so you don't need to install it separately to use it.

:::

## Standalone Usage

### 📦 Installation

:::code-group

```sh [npm]
$ npm install @clerc/plugin-help
```

```sh [yarn]
$ yarn add @clerc/plugin-help
```

```sh [pnpm]
$ pnpm add @clerc/plugin-help
```

:::

### 🚀 Usage

#### Import

```ts
import { helpPlugin } from "@clerc/plugin-help";
// or import directly from clerc
import { helpPlugin } from "clerc";
```

#### Basic Usage

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("My CLI application")
	.version("1.0.0")
	.use(helpPlugin()) // Add help plugin
	.command("hello", "Greeting command")
	.on("hello", (ctx) => {
		console.log("Hello, World!");
	})
	.parse();
```

## Running Effect

```bash
# Show main help, displays root command help when there is a root command, otherwise shows CLI's own help
$ node my-cli --help
# Show CLI's own help
$ node my-cli help

# Show help for a specific command
$ node my-cli hello --help
$ node my-cli help hello
```

## 📝 Features

### Auto-generate Help

The plugin automatically generates beautiful help information for your CLI, including:

- CLI name, version information, and description
- List of available commands
- List of command parameters
- Command options
- Global options
- Custom notes and examples

## Advanced Usage

### Custom Command Help

You can set the `help` option to customize the help information for each command:

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("My CLI application")
	.version("1.0.0")
	.use(helpPlugin())
	.command("deploy", "Deploy command", {
		help: {
			showInHelp: true, // Show this command in help
			notes: [
				"This is a command for deploying applications.",
				"You can use different options to control deployment behavior.",
			],
			examples: [
				["my-cli deploy --env production", "Deploy to production environment"],
				[
					"my-cli deploy --env staging --force",
					"Deploy to staging environment and force execution",
				],
			],
		},
	})
	.parse();
```

### Plugin Options

You can customize the behavior of the help plugin by passing options:

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("My CLI application")
	.version("1.0.0")
	.use(
		helpPlugin({
			command: true, // Enable help command
			flag: true, // Enable --help global option
			showHelpWhenNoCommandSpecified: true, // Show help when no command is specified
			notes: [
				"Welcome to my CLI application!",
				"Use --help to see available commands and options.",
			],
			examples: [
				["my-cli --help", "Show help information"],
				["my-cli hello", "Execute greeting command"],
			],
			banner: "Welcome to My CLI application!", // Custom banner
			formatters: {
				// Custom type formatting functions
				formatFlagType: (type: FlagType) => {
					if (typeof type === "function") {
						return type.name;
					}

					return `Array<${type[0].name}>`;
				},
			},
		}),
	)
	.parse();
```
