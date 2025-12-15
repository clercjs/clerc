---
title: 自动补全插件
---

# @clerc/plugin-completions

为您的 CLI 添加命令行自动补全功能的插件。基于 [@bomb.sh/tab](https://github.com/bombshell-dev/tab)

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
$ my-cli completions bash

# 直接执行以启用自动补全
# PowerShell
$ my-cli completions powershell | Out-String | Invoke-Expression

# Bash
$ eval "$(my-cli completions bash)"

# Zsh
$ eval "$(my-cli completions zsh)"

# 你也可以用 --shell 参数指定 Shell 类型
$ eval "$(my-cli completions --shell bash)"
```

## 📝 功能特性

### 自动生成补全脚本
插件会自动为您的 CLI 生成完整的自动补全脚本，支持：

- 命令名称补全
- 选项名称补全

### 补全逻辑

```sh
$ my-cli <TAB> # 补全可用的命令
$ my-cli command <TAB> # 补全 command 的子命令
$ my-cli -<TAB> # 补全所有全局的短名，如 -h, -V
$ my-cli --<TAB> # 补全所有全局选项
$ my-cli command -<TAB> # 补全 command 所有选项的短名，如 -h, -V，以及全局选项
$ my-cli command --<TAB> # 补全 command 的所有可用选项，包括全局选项
```

### 支持的 Shell

- **Bash** - Linux 和 macOS 默认 Shell
- **Zsh** - macOS Catalina 及以上版本默认 Shell
- **Fish** - 现代 Shell
- **PowerShell** - Windows 默认 Shell
