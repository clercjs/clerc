---
title: Completions Plugin
---

# @clerc/plugin-completions
A plugin to add command-line autocompletion functionality to your CLI, based on [@bomb.sh/tab](https://github.com/bombshell-dev/tab).

## 📦 Installation

:::code-group
```sh [npm]
$ npm install @clerc/plugin-completions
```

```sh [yarn]
$ yarn add @clerc/plugin-completions
```

```sh [pnpm]
$ pnpm add @clerc/plugin-completions
```
:::

## 🚀 Usage

### Import

```ts
import { completionsPlugin } from "@clerc/plugin-completions";
// Or import directly from clerc
import { completionsPlugin } from "clerc";
```

### Basic Usage

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("My CLI application")
	.version("1.0.0")
	.use(completionsPlugin()) // Add the autocompletion plugin
	.command("start", "Start the service")
	.on("start", (ctx) => {
		console.log("Service started");
	})
	.command("stop", "Stop the service")
	.on("stop", (ctx) => {
		console.log("Service stopped");
	})
	.parse();
```

### Running Effect

```bash
# Generate autocompletion script for Bash
$ my-cli completions bash

# Execute directly to enable autocompletion
# PowerShell
$ my-cli completions powershell | Out-String | Invoke-Expression

# Bash
$ eval "$(my-cli completions bash)"

# Zsh
$ eval "$(my-cli completions zsh)"

# You can also specify the shell type with the --shell parameter
$ eval "$(my-cli completions --shell bash)"
```

## 📝 Features

### Automatic Completion Script Generation
The plugin automatically generates a full autocompletion script for your CLI, supporting:
- Command name autocompletion
- Option name autocompletion

### Completion Logic

```sh
$ my-cli <TAB> # Complete available commands
$ my-cli command <TAB> # Complete subcommands of the specified command
$ my-cli -<TAB> # Complete all global short options, e.g., -h, -V
$ my-cli --<TAB> # Complete all global long options
$ my-cli command -<TAB> # Complete short options for the specified command (including global options), e.g., -h, -V
$ my-cli command --<TAB> # Complete all available options for the specified command, including global options
```

### Supported Shells

- **Bash** - Default shell for Linux and macOS
- **Zsh** - Default shell for macOS Catalina and later versions
- **Fish** - A modern shell
- **PowerShell** - Default shell for Windows
