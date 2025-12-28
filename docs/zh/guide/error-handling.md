---
title: 错误处理
---

# 错误处理

Clerc 支持注册一个错误处理函数，用于处理捕获的命令解析、命令运行时等过程中发生的错误。

## 示例

```ts
Clerc.create()
  .scriptName("my-cli")
  .description("My CLI application")
  .version("1.0.0")
  .errorHandler((error: any) => {
    console.error("发生错误：", error.message);
    // 您可以根据需要执行其他操作，例如记录错误、清理资源等
  })
  .command("run", "Run the application")
  .on("run", (ctx) => {
    throw new Error("测试错误处理");
  })
  .parse();
```
