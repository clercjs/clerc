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

## Customizing Sections and Renderers

Pass `help: false` to disable built-in `--help` and the `help` subcommand completely, or pass a `HelpOptions` object:

| Option     | Type                                                 | Description                                                                                                                                   |
| ---------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `command`  | `boolean`                                            | Set `false` to keep `-h, --help` while disabling the built-in `help` subcommand.                                                              |
| `header`   | `MetaAsyncGetter<string \| void>`                    | Static string or sync/async `(meta) => string` prepended above help output.                                                                   |
| `footer`   | `MetaAsyncGetter<string \| void>`                    | Static string or sync/async `(meta) => string` appended below help output.                                                                    |
| `sections` | `Partial<HelpSectionRenderers>`                      | Override or hide any of the 8 default sections (`header`, `usage`, `arguments`, `commands`, `options`, `globalOptions`, `examples`, `notes`). |
| `render`   | `(model, commandPath?) => string \| Promise<string>` | Replace the entire help renderer while still keeping `--help` routing.                                                                        |

```ts
import { cli, defaultHelpSections } from "clerc";

const app = cli({
  name: "acme",
  version: "2.0.0",
  help: {
    command: true,
    footer: (meta) => `Docs: https://example.com/${meta.name}`,
    sections: {
      header: (doc, ctx) => defaultHelpSections.header(doc, ctx),
      notes: () => undefined, // hide NOTES section
    },
  },
});
```

Inside any command handler, call `await ctx.help.print()` (or `await ctx.help.render()`) for root help, or pass a command path such as `await ctx.help.print(["db", "migrate"])`. For programmatic help generation outside a run, use `buildHelpDocument(model, node?)`, `renderHelpDocument(doc, options)`, or `renderHelp(model, options)`.

<CliPlayground :scenario="customHelp" lang="en" />

## Theme Customization (`@clerc/theme`)

Help, diagnostics, and `ctx.log` share a zero-dependency theme built on Node's `node:util` `styleText`. Override any token via `cli({ theme: { ... } })` (or per-invocation via `app.run(argv, { theme })`):

| Token          | Default style           | Used for                                    |
| -------------- | ----------------------- | ------------------------------------------- |
| `brand`        | `"bold"`                | CLI / command title and `step` log label.   |
| `heading`      | `["bold", "underline"]` | Help section headings (`USAGE`, `OPTIONS`). |
| `command`      | `"bold"`                | Command names and argument tokens.          |
| `flag`         | `"bold"`                | Flag names (`-p`, `--port`).                |
| `placeholder`  | `"gray"`                | Value placeholders (`<number>`, `<env>`).   |
| `muted`        | `"gray"`                | Metadata tags, notes, and secondary text.   |
| `error`        | `["bold", "red"]`       | Error labels and diagnostics.               |
| `warn`         | `"yellow"`              | Deprecation tags and warning labels.        |
| `success`      | `"green"`               | Success labels.                             |
| `info`         | `"cyan"`                | Info labels.                                |
| `accent`       | `"cyan"`                | Diagnostic tips and highlighted commands.   |
| `code`         | `"bold"`                | Inline code spans.                          |
| `bold` / `dim` | `"bold"` / `"dim"`      | General emphasis and subtle chrome.         |

Colors respect `NO_COLOR`, `FORCE_COLOR`, `CI`, and TTY detection automatically.
