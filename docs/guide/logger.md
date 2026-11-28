---
title: Logger
---

<script setup>
import { alignedOutput, calloutBox, logLevels } from "./logger.playground.ts";
</script>

# Logger

Every Clerc context includes `ctx.log` (powered by `@clerc/logger` and `@clerc/theme`), and you can create standalone loggers anywhere with `createLogger()`.

## Aligned Output and Error Formatting

All six log methods (`step`, `info`, `success`, `warn`, `error`, `debug`) align along a 5-character right-aligned label column with a `│` detail gutter. Extra arguments are formatted automatically: strings split into lines, objects use `node:util` `inspect`, and `Error` instances render stack frames and `Caused by:` chains.

```ts
import { createLogger } from "clerc";

const log = createLogger({ level: "debug" });

log.step("Building targets", "entry: src/index.ts", "minify: true");
log.info("Resolved config", { port: 3000, cache: true });
log.child("db").child("migrate").debug("Query took 1.2ms");
log.error(
  new TypeError("Invalid port", {
    cause: new Error("PORT env malformed"),
  }),
);
```

<CliPlayground :scenario="alignedOutput" lang="en" />

`warn` and `error` write to `stderr`; `step`, `info`, `success`, and `debug` write to `stdout`.

## Streaming `.line()` Appends

Every log call returns a `LogEntry` with a chainable `.line(...values)` method so long-running steps can append sub-lines under the same gutter (suppressed automatically if the parent log level was filtered out):

```ts
import type { CommandContext } from "clerc";
declare const ctx: CommandContext;
// ---cut---
const entry = ctx.log.step("Applying migrations");
entry.line("0001_init.sql (12ms)");
entry.line("0002_indexes.sql (8ms)");
```

## Callout Panels (`log.box.*`)

`ctx.log.box` exposes the same six methods (`step`, `info`, `success`, `warn`, `error`, `debug`), rendering a rounded panel aligned to the label gutter (with automatic ASCII `+---+` fallback when Unicode is unsupported):

```ts
import type { CommandContext } from "clerc";
declare const ctx: CommandContext;
// ---cut---
ctx.log.box.warn(
  "Dry run mode",
  "No remote changes were written.",
  `Pass ${ctx.log.theme.accent("--confirm")} to execute.`,
);
```

<CliPlayground :scenario="calloutBox" lang="en" />

## Log Levels and Themes

By default, `cli()` registers `-q, --quiet` (`"error"`) and `-v, --verbose` (`"debug"`) flags automatically (yielding if your command defines its own `-q` or `-v`, or disabled via `verbosity: false`). You can also change `ctx.log.level` (`"silent" | "error" | "warn" | "info" | "debug"`) at runtime, write unformatted output with `ctx.log.raw()`, and customize colors via `theme` in `cli({ theme: { brand: ["bold", "cyan"] } })`.

<CliPlayground :scenario="logLevels" lang="en" />
