---
layout: home

hero:
  name: "Clerc"
  text: "Typed CLIs without the boilerplate"
  tagline: "Route-style signatures, Standard Schema validation, Cargo-grade diagnostics, shell completions, and MCP tools for Node.js 24+."
  image:
    src: /Banner.webp
    alt: Clerc logo
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Official Plugins
      link: /official-plugins/plugin-completions
    - theme: alt
      text: API Reference
      link: /reference/api/

features:
  - title: Signature-Driven Types
    details: 'Write "deploy &lt;env&gt; [region] -- [extra...]" and get exact TypeScript inference on ctx.args with zero as const.'
  - title: Standard Schema v1
    details: "Pass Zod, Valibot, ArkType, or built-in Types directly. One schema powers parsing, types, --help, completions, and MCP."
  - title: Help, Hints & Logger Built In
    details: "Editorial --help pages, Levenshtein typo suggestions, and ctx.log with aligned labels, boxes, spinners, and JSON mode."
  - title: Symmetric Plugin System
    details: "clerc() and plugin() share the exact same methods. Inject typed ctx.state via onion middleware with try/finally cleanup."
  - title: Completions & MCP Server
    details: "Generate Bash/Zsh/Fish/PowerShell completions and expose commands as Model Context Protocol tools from the same definition."
  - title: Pure In-Memory Testing
    details: "Run cli.run(argv, { terminal }) with createMemoryTerminal() to assert stdout, stderr, and exit codes without process.exit()."
---

## Try Clerc in Your Browser

<CliPlayground lang="en" />
