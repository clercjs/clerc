---
title: Friendly Error Plugin
---

# @clerc/plugin-friendly-error

A plugin that provides more friendly error messages for your CLI when errors occur.

## 📦 Installation

:::code-group

```sh [npm]
$ npm install @clerc/plugin-friendly-error
```

```sh [yarn]
$ yarn add @clerc/plugin-friendly-error
```

```sh [pnpm]
$ pnpm add @clerc/plugin-friendly-error
```

:::

## 🚀 Usage

### Import

```ts
import { friendlyErrorPlugin } from "@clerc/plugin-friendly-error";
// or import directly from clerc
import { friendlyErrorPlugin } from "clerc";
```

### Basic Usage

```ts
const cli = Clerc.create()
  .scriptName("my-cli")
  .description("My CLI application")
  .version("1.0.0")
  .use(friendlyErrorPlugin()) // Add friendly error plugin
  .command("start", "Start service")
  .on("start", (ctx) => {
    // Simulate an error
    throw new Error("Service failed to start");
  })
  .parse();
```

### Running Effect

```bash
$ node my-cli start
# Outputs friendly error message instead of raw error stack
```
