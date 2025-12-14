---
title: Completions Plugin
---

# @clerc/plugin-completions

A plugin that adds command-line auto-completion functionality to your CLI. Based on [@bomb.sh/tab](https://github.com/bombshell-dev/tab).

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
// or import directly from clerc
import { completionsPlugin } from "clerc";
```

### Basic Usage

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("My CLI application")
	.version("1.0.0")
	.use(completionsPlugin()) // Add auto-completion plugin
	.command("start", "Start service")
	.on("start", (ctx) => {
		console.log("Service started");
	})
	.command("stop", "Stop service")
	.on("stop", (ctx) => {
		console.log("Service stopped");
	})
	.parse();
```

### Running Effect

```bash
# Generate auto-completion script for Bash
$ node my-cli completions bash

# Execute directly to enable auto-completion
# PowerShell
node my-cli completions pwsh | Out-String | Invoke-Expression

# Bash
eval "$(node my-cli completions bash)"

# Zsh
eval "$(node my-cli completions zsh)"

# You can also specify the shell type with the --shell parameter
eval "$(node my-cli completions --shell bash)"

# Or install directly
$ node my-cli completions install bash

# Uninstall
$ node my-cli completions uninstall
```

## 📝 Features

### Auto-generate Completion Scripts

The plugin automatically generates complete auto-completion scripts for your CLI, supporting:

- Command name completion
- Option name completion

### Supported Shells

- **Bash** - Default shell for Linux and macOS
- **Zsh** - Default shell for macOS Catalina and later
- **Fish** - Modern shell
- **PowerShell**(pwsh) - Default shell for Windows

## 🎨 Custom Configuration

### Advanced Configuration

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("My CLI application")
	.version("1.0.0")
	.use(
		completionsPlugin({
			managementCommands: false, // Don't generate install/uninstall commands
		}),
	)
	.parse();
```
