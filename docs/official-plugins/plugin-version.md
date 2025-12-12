---
title: Version Plugin
---

# @clerc/plugin-version

A plugin that adds a version command to your CLI.

:::tip

This plugin is built into the `Clerc` class exported by the `clerc` package, so you don't need to install it separately to use it.

:::

## Standalone Usage

### 📦 Installation

:::code-group

```sh [npm]
$ npm install @clerc/plugin-version
```

```sh [yarn]
$ yarn add @clerc/plugin-version
```

```sh [pnpm]
$ pnpm add @clerc/plugin-version
```

:::

### 🚀 Usage

#### Import

```ts
import { versionPlugin } from "@clerc/plugin-version";
// or import directly from clerc
import { versionPlugin } from "clerc";
```

### Basic Usage

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("My CLI application")
	.version("1.0.0")
	.use(versionPlugin()) // Add version plugin
	.parse();
```

## Running Effect

```bash
# Display version information
$ node my-cli --version
# or
$ node my-cli version

# Output: v1.0.0
```
