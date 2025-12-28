---
title: 拦截器
---

# 拦截器

拦截器是在调用命令处理程序之前或之后运行的函数，类似于 Web 开发中的中间件。

## 用法

可以使用 `interceptor` 方法将拦截器添加到 CLI 中：

```ts
const cli = Clerc.create()
  .scriptName("foo-cli")
  .description("一个简单的 CLI")
  .version("1.0.0")
  .command("foo", "一个 foo 命令")
  .interceptor(async (ctx, next) => {
    console.log("在 foo 之前");
    // 您可以访问上下文
    console.log(!!ctx.command); // 匹配到对应的命令了吗？
    await next(); // 调用 next 继续执行
    console.log("在 foo 之后");
  })
  .parse();
```

:::warning

注意！调用 `next` 时请确保使用 `await`，否则错误可能不会被正确捕获！

:::

## 顺序

`interceptor` 方法接受一个函数或一个对象：

```ts
const cli = Clerc.create()
  .scriptName("foo-cli")
  .description("一个简单的 CLI")
  .version("1.0.0")
  .command("foo", "一个 foo 命令")
  .interceptor({
    enforce: "normal", // 默认值，或者 "pre", "post"
    handler: async (ctx, next) => {
      console.log("在 foo 之前");
      // 您可以访问上下文
      console.log(!!ctx.command); // 匹配到对应的命令了吗？
      await next(); // 调用 next 继续执行
      console.log("在 foo 之后");
    },
  })
  .parse();
```

因此，执行顺序如下：

1. 预拦截器（Pre interceptors）
2. 正常拦截器（Normal interceptors）
3. 后拦截器（Post interceptors）

## 在命令处理程序之后调用

通过在调用 `next()` 之后进行操作，您可以在调用命令处理程序之后执行一些操作：

```ts
const cli = Clerc.create()
  .scriptName("foo-cli")
  .description("一个简单的 CLI")
  .version("1.0.0")
  .command("foo", "一个 foo 命令")
  .interceptor(async (ctx, next) => {
    console.log("在 foo 之前");
    // 您可以访问上下文
    console.log(!!ctx.command); // 匹配到对应的命令了吗？
    await next(); // 调用 next 继续执行
    console.log("在 foo 之后");
  })
  .on("foo", (ctx) => {
    console.log("它运行了！");
  })
  .parse();

// 输出结果为：
// 在 foo 之前
// 它运行了！
// 在 foo 之后
```

## 上下文类型

拦截器的上下文类型为 `InterceptorContext`，目前它就是一个 `BaseContext` 的别名，但是提供了更好的 IDE 类型显示。[查看上下文文档](./context) 了解更多信息。

## 在拦截器中访问选项和参数的行为

在拦截器中，您可以访问 `ctx.flags` 和 `ctx.parameters`，但是由于必需的标志和参数验证错误是在命令处理程序调用之前才抛出的，因此在拦截器中访问这些值时需要小心。

例如，如果您在拦截器中访问一个必需的标志，而用户没有提供该标志，则 `ctx.flags` 中将不会包含该标志，并且在稍后调用命令处理程序时会抛出错误。
