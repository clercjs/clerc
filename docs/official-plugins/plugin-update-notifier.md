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

## `UpdateNotifierOptions` Reference

| Option            | Type                      | Default                        | Description                                                         |
| ----------------- | ------------------------- | ------------------------------ | ------------------------------------------------------------------- |
| `packageName`     | `string`                  | `ctx.model.meta.name`          | npm package name to query.                                          |
| `version`         | `string`                  | `ctx.model.meta.version`       | Current installed version compared against the registry.            |
| `distTag`         | `string`                  | `"latest"`                     | npm dist-tag to check (e.g. `"next"`, `"beta"`).                    |
| `checkIntervalMs` | `number`                  | `86_400_000` (24h)             | Minimum interval between network registry checks.                   |
| `registryUrl`     | `string`                  | `"https://registry.npmjs.org"` | Custom npm registry base URL.                                       |
| `installCommand`  | `string`                  | `` `npm i -g ${name}` ``       | Command displayed inside the update banner.                         |
| `timeoutMs`       | `number`                  | `1500`                         | Abort timeout for the registry HTTP request.                        |
| `postRunGraceMs`  | `number`                  | `250`                          | Maximum wait after the command finishes before skipping the banner. |
| `cacheDir`        | `string`                  | `$XDG_CACHE_HOME` / `~/.cache` | Override cache directory for storing check timestamps.              |
| `fetch`           | `typeof globalThis.fetch` | `globalThis.fetch`             | Custom `fetch` implementation (handy in tests or proxies).          |
| `now`             | `() => number`            | `Date.now`                     | Clock function for deterministic tests.                             |

## Default Behavior

- Automatically skipped in CI (`CI` env set), when `NO_UPDATE_NOTIFIER` is set, or when `!ctx.terminal.isTTY`.
- Suppressed automatically when `-q, --quiet` is passed.
- Starts the registry `fetch` on entry and prints the banner in `finally` after inner middlewares complete.
- An unref'd `postRunGraceMs` timer (default `250ms`) ensures slow networks do not delay process exit.
