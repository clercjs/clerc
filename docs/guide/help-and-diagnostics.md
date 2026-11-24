---
title: Help & Diagnostics
---

# Help & Diagnostics

Clerc treats terminal output as a user interface: `--help` uses an editorial layout with a single hairline rule, uppercase section headings, smart column snapping, and atomic metadata tags that never split across line wraps.

## Grouping Commands & Options

Organize large CLIs with `.groups()` and assign `group` keys on commands or flags:

```ts
import { Types, clerc } from "clerc";

const cli = clerc({
  name: "acme",
  version: "2.0.0",
  description: "Build and deploy modern TypeScript apps",
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

You can add a `header` / `footer`, override individual section renderers via `help.sections`, or inspect the structured AST directly with `buildHelpDocument(cli.buildModel())`:

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

Inside any command handler, `await ctx.help.print()` prints help for the root or a specific subcommand path (`await ctx.help.print(["db", "migrate"])`).

## Actionable Error Diagnostics

Parse and validation errors exit with code `2` (usage error), while runtime/schema errors exit with code `1`. Unknown commands and unknown flags automatically compute Levenshtein distances to suggest the closest match:

<TerminalWindow command="acme deploy prod --outpt dist" :lines='["{red:error} unexpected option: &#39;--outpt&#39;","","  {tip:tip} a similar option exists: &#39;--output&#39;","","      {muted:For more information, try &#39;acme deploy --help&#39;.}"]' />

Throw `ClercError` in your own commands to render matching diagnostics with `detail`, `hints`, and `usage`:

```ts
import { ClercError, clerc } from "clerc";

const cli = clerc({ name: "acme", version: "1.0.0" }).command("publish", {
  run() {
    throw new ClercError("not logged in to registry", {
      code: "ERR_VALIDATION",
      detail: "No token found in ~/.acmerc or ACME_TOKEN",
      usage: "acme login --registry https://registry.example.com",
    }).addHint("run 'acme login' first or set ACME_TOKEN");
  },
});
```

## Custom `.onError()` & JSON Errors

Register `.onError((err, ctx) => ...)` handlers to intercept errors in reverse registration (LIFO) order. Returning `true` marks the error as handled and suppresses default diagnostic printing.

When `ctx.log.format === "json"` (or `logger: { format: "json" }`), unhandled errors serialize as single-line structured JSON to `stderr`:

```json
{
  "error": {
    "code": "ERR_UNKNOWN_COMMAND",
    "message": "unknown command 'buid'",
    "hints": ["a similar command exists: 'build'"],
    "exitCode": 2
  }
}
```
