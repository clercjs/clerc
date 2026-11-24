---
title: Logger & Terminal UI
---

# Logger & Terminal UI

Every Clerc context includes `ctx.log` (powered by `@clerc/logger` and `@clerc/theme`), and you can also create standalone loggers anywhere via `createLogger()`.

## Aligned Rail Typography

All log methods (`step`, `info`, `success`, `warn`, `error`, `debug`) align along a 5-character right-aligned label column with a muted `│` detail gutter. Extra arguments are formatted automatically: strings split into lines, objects use `node:util` `inspect`, and `Error` instances render clean stack frames plus `Caused by:` chains.

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

<TerminalWindow title="Logger output" :lines='[" {brand:step} {bold:Building targets}","      {faint:│} {muted:entry: src/index.ts}","      {faint:│} {muted:minify: true}"," {cyan:info} Resolved config","      {faint:│} {muted:{ port: 3000, cache: true }}","{faint:debug db:migrate › Query took 1.2ms}","{red:error} {bold:Invalid port}","      {faint:│} {muted:TypeError: Invalid port}","      {faint:│   at ...}","      {faint:│} {muted:Caused by: Error: PORT env malformed}"]' />

`warn` and `error` write to `stderr`; `step`, `info`, `success`, and `debug` write to `stdout`.

## Streaming `.line()` Appends

Every log call returns a `LogEntry` with a chainable `.line(...values)` method so long-running steps can stream sub-lines under the same gutter rail (automatically suppressed if the parent log level was filtered out):

```ts
const entry = ctx.log.step("Applying migrations");
entry.line("0001_init.sql (12ms)");
entry.line("0002_indexes.sql (8ms)");
```

## Symmetric `log.box.*` Panels

`ctx.log.box` exposes the exact same six methods (`step`, `info`, `success`, `warn`, `error`, `debug`), rendering a rounded panel aligned to the label gutter (with automatic ASCII `+---+` fallback when Unicode is unsupported):

```ts
ctx.log.box.warn(
  "Dry run mode",
  "No remote changes were written.",
  `Pass ${ctx.theme.accent("--confirm")} to execute.`,
);
```

## Spinners, Tasks & Interactive Prompts

- `ctx.log.task(title, fn)` starts an animated spinner on TTY, updates status messages via `s.message(...)`, and resolves to a `done` or `error` line automatically (degrading cleanly to static `step` / `done` lines in CI or non-TTY).
- `ctx.log.spinner()` gives manual `.start()`, `.message()`, `.stop()`, `.cancel()`, and `.error()` control.
- `prompts` re-exports `@clack/prompts` (`text`, `select`, `confirm`, `multiselect`, `autocomplete`) for interactive workflows.

```ts
import { clerc, prompts } from "clerc";

const cli = clerc({ name: "acme", version: "1.0.0" }).command("deploy", {
  async run(ctx) {
    const confirmed = await prompts.confirm({
      message: "Deploy to production?",
    });
    if (!confirmed || prompts.isCancel(confirmed)) {
      return;
    }

    await ctx.log.task("Uploading artifacts...", async (s) => {
      s.message("Compressing 14 chunks...");

      return "Uploaded 14 chunks in 420ms";
    });
  },
});
```

## Runtime Level, JSON Format & Custom Theme

Mutate `ctx.log.level` (`"silent" | "error" | "warn" | "info" | "debug"`) or `ctx.log.format` (`"pretty" | "json"`) at runtime - child loggers share the same state. Customize colors globally via `theme` in `clerc({ theme: { brand: ["bold", "cyan"] } })`.
