---
layout: home

hero:
  name: "Clerc"
  text: "告别样板代码的强类型 CLI 框架"
  tagline: "面向 Node.js 24+，集路由式命令签名、Standard Schema 校验、Cargo 风格错误诊断、Shell 补全与 MCP 服务于一体。"
  image:
    src: /Banner.webp
    alt: Clerc logo
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/guide/getting-started
    - theme: alt
      text: 官方插件
      link: /zh/official-plugins/plugin-completions
    - theme: alt
      text: API 参考
      link: /zh/reference/api/

features:
  - title: 签名即类型
    details: '直接写 "deploy &lt;env&gt; [region] -- [extra...]"，无需 as const 即可精确推导 ctx.args 类型，写错键名编译期直接报错。'
  - title: 原生支持 Standard Schema v1
    details: "直接传入 Zod、Valibot、ArkType 或内置 Types，同一份 Schema 同时驱动解析、TS 类型、--help、补全与 MCP。"
  - title: 内置帮助、拼写纠错与日志
    details: "开箱自带排版级 --help、编辑距离拼写提示，以及支持流式追加、边框面板、Spinner 与 JSON 模式的 ctx.log。"
  - title: 应用与插件同构 API
    details: "clerc() 与 plugin() 共享完全一致的方法。通过洋葱中间件 next({ db }) 注入强类型 ctx.state 并用 try/finally 安全释放。"
  - title: 一处定义生成补全与 MCP
    details: "挂载官方插件即可生成 Bash/Zsh/Fish/PowerShell 补全脚本，或通过 &lt;cli&gt; mcp 向 AI Agent 暴露工具与帮助资源。"
  - title: 纯内存无副作用测试
    details: "使用 cli.run(argv, { terminal: createMemoryTerminal() }) 在内存中捕获输出与退出码，绝不污染全局变量或调用 process.exit()。"
---

## 在浏览器中直接体验

<CliPlayground lang="zh" />
