---
title: Help
---

<script setup>
import scenario from "./help.playground.ts";
</script>

# Help

Clerc formats `--help` with a top rule, uppercase section headings, aligned columns, and metadata tags (`[default: ...]`, `[env: ...]`) that stay intact when lines wrap.

<CliPlayground :scenario="scenario" lang="en" />

## Grouping Commands and Options

Organize large CLIs with `.groups()` and assign `group` keys on commands or flags:

```ts
import { Types, clerc } from "clerc";

const cli = clerc({
  name: "acme",
  version: "2.0.0",
  description: "Build and deploy TypeScript apps",
  examples: [["$ acme build src/index.ts -p 8080", "Build with custom port"]],
  notes: ["Set NO_COLOR=1 to disable ANSI colors."],
}).groups({
  commands: { core: "Core" },
  flags: { input: "Input Options" },
});

cli.command("build <entry>", {
  aliases: ["b"],
  group: "core",
  description: "Compile source files",
  args: { entry: { description: "Entry file path" } },
  flags: {
    output: { type: String, short: "o", description: "Output directory" },
    src: { type: String, group: "input", description: "Source directory" },
    cache: {
      type: Boolean,
      default: true,
      group: "input",
      description: "Use build cache",
    },
  },
  run() {},
});
```

<TerminalWindow command="acme build --help" :lines='["{muted:acme} {brand:build} {muted:v2.0.0  alias: b}","Compile source files","{muted:────────────────────────────────────────────────────────────────────}","{heading:USAGE}   {bold:acme build} {muted:[options]} {muted:&lt;entry&gt;}","","{heading:ARGUMENTS}","  {bold:&lt;entry&gt;}                  Entry file path","","{heading:OPTIONS}","  {cyan:-o}{muted:, }{cyan:--output} {muted:&lt;string&gt;}    Output directory","","{heading:INPUT OPTIONS}","      {cyan:--src} {muted:&lt;string&gt;}       Source directory","      {cyan:--cache}{muted:, }{cyan:--no-cache}  Use build cache  {muted:[default: true]}","","{heading:GLOBAL OPTIONS}","  {cyan:-h}{muted:, }{cyan:--help}               Show help"]' />

## Customizing Help Sections

You can add a `header` or `footer`, override individual section renderers via `help.sections`, or inspect the structured AST directly with `buildHelpDocument(cli.buildModel())`:

```ts
import { clerc, defaultHelpSections } from "clerc";

const cli = clerc({
  name: "acme",
  version: "2.0.0",
  help: {
    footer: (meta) => `Docs: https://example.com/${meta.name}`,
    sections: {
      header: (doc, ctx) => defaultHelpSections.header(doc, ctx),
      notes: () => undefined, // hide NOTES section
    },
  },
});
```

Inside any command handler, call `await ctx.help.print()` to print root help or pass a command path such as `await ctx.help.print(["db", "migrate"])`.
