---
title: 友好错误插件
---

# @clerc/plugin-friendly-error

在产生报错时，为您的 CLI 提供更友好的错误信息的插件。

## 📦 安装

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

## 🚀 使用方法

### 导入

```ts
import { friendlyErrorPlugin } from "@clerc/plugin-friendly-error";
// 或者直接从 clerc 导入
import { friendlyErrorPlugin } from "clerc";
```

### 基本用法

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("我的 CLI 应用程序")
	.version("1.0.0")
	.use(friendlyErrorPlugin()) // 添加友好错误插件
	.command("start", "启动服务")
	.on("start", (ctx) => {
		// 模拟一个错误
		throw new Error("服务启动失败");
	})
	.parse();
```

### 运行效果

```bash
$ node my-cli start
# 输出友好的错误信息而不是原始错误堆栈
```
