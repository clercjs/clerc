---
title: "@clerc/plugin-update-notifier"
---

# @clerc/plugin-update-notifier

Zero-dependency background npm update checker middleware. Starts checking the npm registry concurrently while the command runs, caches results on disk (`$XDG_CACHE_HOME/clerc-update-notifier`), and renders a `ctx.log.box.warn` banner after execution finishes without slowing down fast commands.

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

Place `updateNotifier()` at the front of `use: [...]` so it starts checking early and prints the banner after inner middlewares finish cleaning up:

```ts
import { updateNotifier } from "@clerc/plugin-update-notifier";
import { cli } from "clerc";

const app = cli({
  name: "acme-cli",
  version: "2.0.0",
  use: [
    updateNotifier({
      // All options are optional; defaults to ctx.model.meta.name and ctx.model.meta.version
      checkIntervalMs: 1000 * 60 * 60 * 24, // 24h
      postRunGraceMs: 250,
    }),
  ],
  commands: [
    // ...
  ],
});
```

<TerminalWindow title="Stderr after command finishes" :lines='[" {yellow:warn} {faint:╭─} {bold:Update available:} {muted:2.0.0} → {green:2.1.0} {faint:───╮}","      {faint:│}  {muted:Run} {cyan:npm i -g acme-cli} {muted:to update}    {faint:│}","      {faint:╰─────────────────────────────────────╯}"]' />

## Default Behavior

- Automatically skipped in CI (`CI` env set), when `NO_UPDATE_NOTIFIER` is set, or when `!ctx.terminal.isTTY`.
- Suppressed automatically when `-q, --quiet` is passed.
- Starts the registry `fetch` on entry and prints the banner in `finally` after inner middlewares complete.
- An unref'd `postRunGraceMs` timer (default `250ms`) ensures slow networks do not delay process exit.
