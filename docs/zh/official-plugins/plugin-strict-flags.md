---
title: 严格选项插件
---

# @clerc/plugin-strict-flags

当传递未知选项时抛出错误的插件。

## 📦 安装

:::code-group

```sh [npm]
$ npm install @clerc/plugin-strict-flags
```

```sh [yarn]
$ yarn add @clerc/plugin-strict-flags
```

```sh [pnpm]
$ pnpm add @clerc/plugin-strict-flags
```

:::

## 🚀 使用方法

### 导入

```ts
import { strictFlagsPlugin } from "@clerc/plugin-strict-flags";
// 或者直接从 clerc 导入
import { strictFlagsPlugin } from "clerc";
```

### 基本用法

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("我的 CLI 应用程序")
	.version("1.0.0")
	.use(strictFlagsPlugin()) // 添加严格选项插件
	.command("start", "启动服务", {
		flags: {
			port: {
				type: Number,
				description: "服务端口",
				default: 3000,
			},
			host: {
				type: String,
				description: "服务主机",
				default: "localhost",
			},
		},
	})
	.on("start", (ctx) => {
		console.log(`在 ${ctx.flags.host}:${ctx.flags.port} 启动服务`);
	})
	.parse();
```

### 运行效果

```bash
# 正确的用法
$ node my-cli start --port 8080 --host 0.0.0.0
# 输出: 在 0.0.0.0:8080 启动服务

# 传递未知选项会抛出错误
$ node my-cli start --port 8080 --unknown-flag
# Unexpected flag: --unknown-flag
```
