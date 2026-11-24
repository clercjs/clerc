---
title: Spinners and Prompts
---

<script setup>
import {
  interactivePrompts,
  manualSpinner,
  taskSpinner,
} from "./prompts.playground.ts";
</script>

# Spinners and Prompts

Clerc includes task spinners on `ctx.log` and re-exports `@clack/prompts` as `prompts` for interactive terminal input.

## Task Spinners (`ctx.log.task`)

`ctx.log.task(title, fn)` runs an animated spinner on interactive TTYs, lets you update status via `s.message(...)`, and prints a `done` line on success. On failure it clears the spinner and rethrows so Clerc reports the error once (pass `{ errorMessage }` if you also want a task-level error line). In CI or non-TTY environments, it falls back to static `step` and `done` lines.

```ts
import { clerc } from "clerc";

const cli = clerc({ name: "acme", version: "1.0.0" }).command("upload", {
  async run(ctx) {
    await ctx.log.task("Uploading artifacts...", async (s) => {
      s.message("Compressing 14 chunks...");

      return "Uploaded 14 chunks in 420ms";
    });
  },
});
```

<CliPlayground :scenario="taskSpinner" lang="en" />

## Manual Spinner (`ctx.log.spinner`)

When you need explicit lifecycle control, use `ctx.log.spinner()`, which exposes `.start()`, `.message()`, `.stop()`, `.cancel()`, and `.error()`.

```ts
const s = ctx.log.spinner();
s.start("Connecting to cluster...");
s.message("Authenticating...");
s.stop("Connected");
```

<CliPlayground :scenario="manualSpinner" lang="en" />

## Interactive Prompts

`prompts` re-exports `@clack/prompts` (`text`, `select`, `confirm`, `multiselect`, `autocomplete`, `isCancel`) so you do not need to install it separately:

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

    await ctx.log.task("Deploying...", async () => "Deployed to production");
  },
});
```

<CliPlayground :scenario="interactivePrompts" lang="en" />
