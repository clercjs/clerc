---
title: "@clerc/plugin-update-notifier"
---

# @clerc/plugin-update-notifier

Zero-dependency background npm update checker. Starts checking the npm registry concurrently while the command runs, caches results on disk (`$XDG_CACHE_HOME/clerc-update-notifier`), and renders a `ctx.log.box.warn` banner after execution finishes without slowing down fast commands.

## Installation

::: code-group

```sh [pnpm]
pnpm add @clerc/plugin-update-notifier
```

```sh [npm]
npm install @clerc/plugin-update-notifier
```

:::

## Usage

```ts
import { updateNotifierPlugin } from "@clerc/plugin-update-notifier";
import { clerc } from "clerc";

const cli = clerc({
  name: "acme-cli",
  version: "2.0.0",
}).use(
  updateNotifierPlugin({
    // All options are optional; defaults to ctx.model.meta.name and ctx.model.meta.version
    checkIntervalMs: 1000 * 60 * 60 * 24, // 24h
    postRunGraceMs: 250,
  }),
);
```

<TerminalWindow title="Stderr after command finishes" :lines='[" {yellow:warn} {faint:╭─} {bold:Update available:} {muted:2.0.0} → {green:2.1.0} {faint:───╮}","      {faint:│}  {muted:Run} {cyan:npm i -g acme-cli} {muted:to update}    {faint:│}","      {faint:╰─────────────────────────────────────╯}"]' />

## Default Behavior

- Automatically skipped in CI (`CI` env set), when `NO_UPDATE_NOTIFIER` is set, or when `!ctx.terminal.isTTY`.
- Suppressed automatically when `-q, --quiet` is passed.
- Runs with `{ enforce: "pre" }`: starts the `fetch` as early as possible and prints the banner after all other middlewares finish.
- An unref'd `postRunGraceMs` timer (default `250ms`) ensures slow networks do not delay process exit.
