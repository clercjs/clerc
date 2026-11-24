---
title: "updateNotifierPlugin (Built-in)"
---

# `updateNotifierPlugin`

Built directly into `clerc` with zero third-party dependencies. Checks the npm registry concurrently in the background while the command runs, caches results on disk (`$XDG_CACHE_HOME/clerc-update-notifier`), and renders a `ctx.log.box.warn` banner after execution finishes without slowing down fast commands.

## Usage

```ts
import { clerc, updateNotifierPlugin } from "clerc";

const cli = clerc({
  name: "acme-cli",
  version: "2.0.0",
}).use(
  updateNotifierPlugin({
    // All options are optional - defaults to ctx.meta.name & ctx.meta.version
    checkIntervalMs: 1000 * 60 * 60 * 24, // 24h
    postRunGraceMs: 250,
  }),
);
```

<TerminalWindow title="Stderr after command finishes" :lines='["{yellow:warn }  {faint:╭─} {bold:Update available:} {muted:2.0.0} → {green:2.1.0} {faint:───╮}","       {faint:│}  {muted:Run} {cyan:npm i -g acme-cli} {muted:to update}    {faint:│}","       {faint:╰─────────────────────────────────────╯}"]' />

## Smart Defaults

- Automatically skipped in CI (`CI` env set), when `NO_UPDATE_NOTIFIER` is set, or when `!ctx.terminal.isTTY`.
- Runs with `{ enforce: "pre" }`: starts the `fetch` as early as possible and prints the banner after all other middlewares finish.
- Unref'd `postRunGraceMs` timer (default `250ms`) guarantees slow networks never hang a completed CLI command.
