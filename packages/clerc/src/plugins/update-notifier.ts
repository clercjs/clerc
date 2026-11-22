import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { definePlugin } from "@clerc/core";

export interface UpdateInfo {
  readonly current: string;
  readonly latest: string;
  readonly name: string;
}

export interface UpdateNotifierPluginOptions {
  readonly pkg: { readonly name: string; readonly version: string };
  readonly distTag?: string;
  readonly checkIntervalMs?: number;
  readonly registryUrl?: string;
  readonly installCommand?: string;
  readonly timeoutMs?: number;
  readonly cacheDir?: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => number;
  readonly forceCheckInCI?: boolean;
}

interface UpdateCache {
  readonly lastCheck: number;
  readonly latest?: string;
}

const DEFAULT_INTERVAL_MS = 1000 * 60 * 60 * 24; // 24 hours
const DEFAULT_TIMEOUT_MS = 3000;
const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)/;

function parseSemver(
  version: string,
): readonly [number, number, number] | null {
  const match = SEMVER_RE.exec(version.trim());
  if (!match) {
    return null;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isNewerVersion(current: string, latest: string): boolean {
  const c = parseSemver(current);
  const l = parseSemver(latest);
  if (!c || !l) {
    return false;
  }

  return l[0] === c[0]
    ? l[1] === c[1]
      ? l[2] > c[2]
      : l[1] > c[1]
    : l[0] > c[0];
}

function getCacheFilePath(
  pkgName: string,
  env: Readonly<Record<string, string | undefined>>,
  overrideDir?: string,
): string {
  const baseDir =
    overrideDir ?? env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache");
  const safeName = pkgName.replace(/[^\w.-]/g, "_");

  return path.join(baseDir, "clerc-update-notifier", `${safeName}.json`);
}

async function readCache(filePath: string): Promise<UpdateCache | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as UpdateCache;

    return typeof parsed.lastCheck === "number" ? parsed : null;
  } catch {
    return null;
  }
}

async function writeCache(filePath: string, cache: UpdateCache): Promise<void> {
  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(cache), "utf8");
  } catch {
    // Ignore cache write errors in read-only environments
  }
}

async function fetchLatestVersion(
  pkgName: string,
  distTag: string,
  registryUrl: string,
  timeoutMs: number,
  fetchFn: typeof globalThis.fetch,
): Promise<string | undefined> {
  try {
    const base = registryUrl.replace(/\/+$/, "");
    const url = `${base}/${encodeURIComponent(pkgName)}/${encodeURIComponent(distTag)}`;
    const response = await fetchFn(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return undefined;
    }
    const data = (await response.json()) as { version?: unknown };

    return typeof data.version === "string" ? data.version : undefined;
  } catch {
    return undefined;
  }
}

export function updateNotifierPlugin(options: UpdateNotifierPluginOptions) {
  const {
    pkg,
    distTag = "latest",
    checkIntervalMs = DEFAULT_INTERVAL_MS,
    registryUrl = "https://registry.npmjs.org",
    installCommand = `npm i -g ${pkg.name}`,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    cacheDir,
    fetch: fetchFn = globalThis.fetch,
    now = () => Date.now(),
    forceCheckInCI = false,
  } = options;

  return definePlugin({
    name: "clerc:update-notifier",
    extendContext: () => ({
      updateNotifier: { info: undefined as UpdateInfo | undefined },
    }),
    hooks: {
      beforeRun: async (ctx) => {
        const env = ctx.terminal.env;
        if (
          !forceCheckInCI &&
          (Boolean(env.CI) ||
            Boolean(env.NO_UPDATE_NOTIFIER) ||
            !ctx.terminal.isTTY)
        ) {
          return;
        }

        const cacheFile = getCacheFilePath(pkg.name, env, cacheDir);
        const cache = await readCache(cacheFile);
        const currentTime = now();

        let latest = cache?.latest;
        const isStale =
          !cache || currentTime - cache.lastCheck >= checkIntervalMs;

        if (isStale) {
          const fetched = await fetchLatestVersion(
            pkg.name,
            distTag,
            registryUrl,
            timeoutMs,
            fetchFn,
          );
          if (fetched) {
            latest = fetched;
          }
          await writeCache(cacheFile, {
            lastCheck: currentTime,
            latest,
          });
        }

        if (latest && isNewerVersion(pkg.version, latest)) {
          ctx.updateNotifier.info = {
            name: pkg.name,
            current: pkg.version,
            latest,
          };
          ctx.log.callout({
            tone: "warn",
            title: `Update available: ${ctx.theme.muted(pkg.version)} → ${ctx.theme.success(latest)}`,
            lines: [`Run ${ctx.theme.accent(installCommand)} to update`],
          });
        }
      },
    },
  });
}
