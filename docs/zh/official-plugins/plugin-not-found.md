---
title: 命令未找到插件
---

# @clerc/plugin-not-found

当命令未找到时显示友好错误消息，提示可能的命令的插件。

## 📦 安装

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

## 🚀 使用方法

### 导入

```ts
import { notFoundPlugin } from "@clerc/plugin-not-found";
// 或者直接从 clerc 导入
import { notFoundPlugin } from "clerc";
```

### 基本用法

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("我的 CLI 应用程序")
	.version("1.0.0")
	.use(notFoundPlugin()) // 添加命令未找到插件
	.command("start", "启动服务")
	.on("start", (ctx) => {
		console.log("服务已启动");
	})
	.parse();
```

### 运行效果

```bash
# 当用户输入不存在的命令时
$ node my-cli star
# Command "star" not found.
# Did you mean "start"?
```
