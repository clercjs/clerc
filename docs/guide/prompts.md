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

Clerc includes task spinners on `ctx.log` and re-exports `@clack/prompts` from `clerc/prompts` for interactive terminal input.

## Task Spinners (`ctx.log.task`)

`ctx.log.task(title, fn)` runs an animated spinner on interactive TTYs, lets you update status via `s.message(...)`, and prints a `done` line on success. On failure it clears the spinner and rethrows so Clerc reports the error once (pass `{ errorMessage }` if you also want a task-level error line). In CI or non-TTY environments, it falls back to static `step` and `done` lines.

```ts
import { cli, command } from "clerc";

const upload = command("upload", {
  async run(ctx) {
    await ctx.log.task("Uploading artifacts...", async (s) => {
      s.message("Compressing 14 chunks...");

      return "Uploaded 14 chunks in 420ms";
    });
  },
});

const app = cli({ name: "acme", version: "1.0.0", commands: [upload] });
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

`clerc/prompts` re-exports `@clack/prompts` (`text`, `select`, `confirm`, `multiselect`, `autocomplete`, `isCancel`) as a dedicated subpath so non-interactive commands skip loading prompt widgets at startup. You can import it at the top level or lazily inside a command's `run()` handler:

```ts
import { cli, command } from "clerc";
import * as prompts from "clerc/prompts";

const deploy = command("deploy", {
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

const app = cli({ name: "acme", version: "1.0.0", commands: [deploy] });
```

<CliPlayground :scenario="interactivePrompts" lang="en" />
