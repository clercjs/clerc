---
title: 更新通知插件
---

# @clerc/plugin-update-notifier

使用 `update-notifier` 检查 CLI 更新的插件。

## 📦 安装

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

## 🚀 使用方法

### 导入

```ts
import { updateNotifierPlugin } from "@clerc/plugin-update-notifier";
```

### 基本用法

```ts
import { Clerc } from "@clerc/core";
import { updateNotifierPlugin } from "@clerc/plugin-update-notifier";

import pkg from "./package.json";

Clerc.create().use(updateNotifierPlugin({ pkg })).parse();
```

## ⚙️ 选项

`updateNotifierPlugin` 接受一个包含以下选项的对象：

### `pkg`

- 类型: `object`
- **必填**

您的 CLI 的 `package.json` 对象。

### `position`

- 类型: `"pre" | "post"`
- 默认值: `"pre"`

更新通知显示的位置。`'pre'` 在命令执行前显示，`'post'` 在命令执行后显示。

### `notify`

- 类型: `EnhancedNotifyOptions`

`notifier.notify()` 的选项。它继承自 `update-notifier` 的 `NotifyOptions`，但 `message` 属性也可以是一个接收 `UpdateNotifier` 实例的函数。

```ts
updateNotifierPlugin({
  pkg,
  notify: {
    message: (notifier) => `有新版本可用: ${notifier.update.latest}`,
  },
});
```

### 其他选项

其他选项将直接传递给 `update-notifier`。有关更多详细信息，请参阅 [update-notifier 文档](https://github.com/sindresorhus/update-notifier#notifier--updatenotifieroptions)。

## 🛠️ 上下文

该插件将 `updateNotifier` 实例添加到 `cli.store` 中。

```ts
cli.interceptor({
  handler: (ctx, next) => {
    console.log(ctx.store.updateNotifier);

    return next();
  },
});
```
