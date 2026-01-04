---
title: Update Notifier Plugin
---

# @clerc/plugin-update-notifier

A plugin to check for CLI updates using `update-notifier`.

## 📦 Installation

:::code-group

```sh [npm]
$ npm install @clerc/plugin-update-notifier
```

```sh [yarn]
$ yarn add @clerc/plugin-update-notifier
```

```sh [pnpm]
$ pnpm add @clerc/plugin-update-notifier
```

:::

## 🚀 Usage

### Import

```ts
import { updateNotifierPlugin } from "@clerc/plugin-update-notifier";
// or import directly from clerc
import { updateNotifierPlugin } from "clerc";
```

### Basic Usage

```ts
import pkg from "./package.json";

Clerc.create().use(updateNotifierPlugin({ pkg })).parse();
```

## ⚙️ Options

The `updateNotifierPlugin` accepts an object with the following options:

### `pkg`

- Type: `object`
- **Required**

The `package.json` object of your CLI.

### `position`

- Type: `"pre" | "post"`
- Default: `"pre"`

Position of the update notification. `'pre'` shows before command execution, `'post'` shows after.

### `notify`

- Type: `EnhancedNotifyOptions`

Options for `notifier.notify()`. It inherits from `update-notifier`'s `NotifyOptions`, but the `message` property can also be a function that receives the `UpdateNotifier` instance.

```ts
updateNotifierPlugin({
  pkg,
  notify: {
    message: (notifier) => `Update available: ${notifier.update.latest}`,
  },
});
```

### Other Options

Other options are passed directly to `update-notifier`. See [update-notifier documentation](https://github.com/sindresorhus/update-notifier#notifier--updatenotifieroptions) for more details.

## 🛠️ Context

This plugin adds the `updateNotifier` instance to the `cli.store`.

```ts
cli.interceptor({
  handler: (ctx, next) => {
    console.log(ctx.store.updateNotifier);

    return next();
  },
});
```
