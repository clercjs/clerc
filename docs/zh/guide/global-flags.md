---
title: 全局选项
---

# 全局选项

Clerc 支持全局注册一个或多个选项，这些选项可以在所有命令中使用。

有关选项的详细信息，请参阅[选项文档](./flags)。

## 示例

```ts
Clerc.create()
  .scriptName("my-cli")
  .description("My CLI application")
  .version("1.0.0")
  .globalFlag("verbose", "Enable verbose output", {
    type: Boolean,
  }) // 全局选项，带描述
  .command("run", "Run the application")
  .on("run", (ctx) => {
    if (ctx.flags.verbose) {
      console.log("Verbose mode enabled");
    }
    console.log("Running the application...");
  })
  .parse();
```

## 可选描述

描述参数是可选的。如果你不需要记录标志，可以省略它：

```ts
const cli = Clerc.create()
  .scriptName("my-cli")
  .description("My CLI application")
  .version("1.0.0")
  .globalFlag("verbose", {
    type: Boolean,
    // 无描述
  })
  .globalFlag("debug", "Enable debug mode", {
    type: Boolean,
    // 或带描述
  })
  .parse();
```

## 替代语法

从版本 1.0.0 开始，你也可以使用替代语法，其中第二个参数是选项对象而不是字符串描述：

```ts
const cli = Clerc.create()
  .scriptName("my-cli")
  .description("My CLI application")
  .version("1.0.0")
  // 直接使用选项对象
  .globalFlag("verbose", {
    type: Boolean,
    description: "Enable verbose output",
  })
  // 或没有描述
  .globalFlag("debug", {
    type: Boolean,
  })
  .parse();
```
