---
title: Not Found Plugin
---

# @clerc/plugin-not-found

A plugin that displays friendly error messages and suggests possible commands when a command is not found.

## 📦 Installation

:::code-group

```sh [npm]
$ npm install @clerc/plugin-not-found
```

```sh [yarn]
$ yarn add @clerc/plugin-not-found
```

```sh [pnpm]
$ pnpm add @clerc/plugin-not-found
```

:::

## 🚀 Usage

### Import

```ts
import { notFoundPlugin } from "@clerc/plugin-not-found";
// or import directly from clerc
import { notFoundPlugin } from "clerc";
```

### Basic Usage

```ts
const cli = Clerc.create()
  .scriptName("my-cli")
  .description("My CLI application")
  .version("1.0.0")
  .use(notFoundPlugin()) // Add not found plugin
  .command("start", "Start service")
  .on("start", (ctx) => {
    console.log("Service started");
  })
  .parse();
```

### Running Effect

```bash
# When user enters a non-existent command
$ node my-cli star
# Command "star" not found.
# Did you mean "start"?
```
