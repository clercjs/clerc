---
title: 快速开始
---

# 快速开始

:::warning

Clerc 仅支持 ESM！

:::

## 安装

:::info

`clerc` 包导出了一个 `Cli` 函数，它等价于 `Clerc.create().use(versionPlugin).use(helpPlugin)`。这提供了一个便捷的方式来创建一个内置了版本和帮助插件的 CLI。

如果您需要更多控制，可以直接使用 `Clerc.create()` 并手动添加插件。

同时，`clerc` 包的体积可能会较大，因为它重新导出了所有官方插件。但如果您的打包工具支持 tree-shaking，则影响不大。若想减小体积，请按需安装 `@clerc/core` 和所需插件。

:::

:::code-group

```sh [npm]
$ npm install clerc
```

```sh [yarn]
$ yarn add clerc
```

```sh [pnpm]
$ pnpm add clerc
```

:::

## 最简单的 CLI 示例

安装 clerc，并创建一个名为 `cli.mjs` 的文件：

```ts
import { Cli } from "clerc";

Cli() // 创建一个新的 CLI，内置帮助和版本插件
  .name("foo") // 可选，CLI 可读名称
  .scriptName("foo") // CLI 脚本名称 (用于运行 CLI 的命令)
  .description("一个 foo CLI") // CLI 描述
  .version("0.0.0") // CLI 版本
  .command(
    "bar", // 命令名称
    "A bar command", // 命令描述
  )
  .on(
    "bar",
    (
      _ctx, // 命令上下文，但我们还没有使用它
    ) => {
      console.log("Hello, world from Clerc.js!");
    },
  )
  .parse(); // 解析参数并运行！
```

然后运行：`node cli.mjs bar`。它应该在您的 shell 中输出：`Hello, world from Clerc.js!`
