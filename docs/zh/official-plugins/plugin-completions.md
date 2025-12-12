---
title: 自动补全插件
---

# @clerc/plugin-completions

为您的 CLI 添加命令行自动补全功能的插件。基于 [@pnpm/tabtab](https://github.com/pnpm/tabtab)

## 📦 安装

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

## 🚀 使用方法

### 导入

```ts
import { completionsPlugin } from "@clerc/plugin-completions";
// 或者直接从 clerc 导入
import { completionsPlugin } from "clerc";
```

### 基本用法

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("我的 CLI 应用程序")
	.version("1.0.0")
	.use(completionsPlugin()) // 添加自动补全插件
	.command("start", "启动服务")
	.on("start", (ctx) => {
		console.log("服务已启动");
	})
	.command("stop", "停止服务")
	.on("stop", (ctx) => {
		console.log("服务已停止");
	})
	.parse();
```

### 运行效果

```bash
# 生成 Bash 的自动补全脚本
$ node my-cli completions bash

# 直接执行以启用自动补全
# PowerShell
node my-cli completions pwsh | Out-String | Invoke-Expression

# Bash
eval "$(node my-cli completions bash)"

# Zsh
eval "$(node my-cli completions zsh)"

# 你也可以用 --shell 参数指定 Shell 类型
eval "$(node my-cli completions --shell bash)"

# 或者直接安装
$ node my-cli completions install bash

# 卸载
$ node my-cli completions uninstall
```

## 📝 功能特性

### 自动生成补全脚本

插件会自动为您的 CLI 生成完整的自动补全脚本，支持：

- 命令名称补全
- 选项名称补全

### 支持的 Shell

- **Bash** - Linux 和 macOS 默认 Shell
- **Zsh** - macOS Catalina 及以上版本默认 Shell
- **Fish** - 现代 Shell
- **PowerShell**(pwsh) - Windows 默认 Shell

## 🎨 自定义配置

### 高级配置

```ts
import { completionsPlugin } from "@clerc/plugin-completions"; // 或者直接从 clerc 导入

const cli = Clerc.create()
	.scriptName("my-cli")
	.description("我的 CLI 应用程序")
	.version("1.0.0")
	.use(
		completionsPlugin({
			managementCommands: false, // 不生成安装/卸载命令
		}),
	)
	.parse();
```
