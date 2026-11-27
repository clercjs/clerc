---
title: Help
---

<script setup>
import { customHelp, groupedHelp } from "./help.playground.ts";
</script>

# Help

Clerc formats `--help` with uppercase section headings, aligned columns, and metadata tags (`[default: ...]`, `[env: ...]`) that stay intact when lines wrap.

## Grouping Commands and Options

Use the overloaded `group(title, target)` combinator to group either commands inside `commands: [...]` or flags inside `flags: [...]`:

```ts
import { cli, command, group } from "clerc";

const build = command("build <entry>", {
  aliases: ["b"],
  description: "Compile source files",
  args: { entry: { description: "Entry file path" } },
  flags: [
    { output: { type: String, short: "o", description: "Output directory" } },
    group("Input Options", {
      src: { type: String, description: "Source directory" },
      cache: {
        type: Boolean,
        default: true,
        description: "Use build cache",
      },
    }),
  ],
  run() {},
});

const app = cli({
  name: "acme",
  version: "2.0.0",
  description: "Build and deploy TypeScript apps",
  examples: [["$ acme build src/index.ts -o dist", "Build with custom outDir"]],
  notes: ["Set NO_COLOR=1 to disable ANSI colors."],
  commands: [group("Core", [build])],
});
```

<CliPlayground :scenario="groupedHelp" lang="en" />

## Customizing Help Sections

You can add a `header` or `footer`, override individual section renderers via `help.sections`, or inspect the structured AST directly with `buildHelpDocument(app.buildModel())`:

```ts
import { cli, defaultHelpSections } from "clerc";

const app = cli({
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

<CliPlayground :scenario="customHelp" lang="en" />
