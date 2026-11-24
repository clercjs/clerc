import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { plugin } from "clerc";

export interface UpdateInfo {
  readonly current: string;
  readonly latest: string;
  readonly name: string;
}

export interface UpdateNotifierPluginOptions {
  /**
   * Package name on npm. Defaults to `ctx.model.meta.name`.
   */
  readonly packageName?: string;
  /**
   * Current CLI version. Defaults to `ctx.model.meta.version`.
   */
  readonly version?: string;
  readonly distTag?: string;
  readonly checkIntervalMs?: number;
  readonly registryUrl?: string;
  readonly installCommand?: string;
  /**
   * Maximum milliseconds to wait for the npm registry check.
   *
   * @default 1500
   */
  readonly timeoutMs?: number;
  /**
   * Maximum milliseconds to wait after command execution finishes before
   * skipping the update banner so fast commands are never blocked.
   *
   * @default 250
   */
  readonly postRunGraceMs?: number;
  readonly cacheDir?: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => number;
}

interface UpdateCache {
  readonly lastCheck: number;
  readonly latest?: string;
}

const DEFAULT_INTERVAL_MS = 1000 * 60 * 60 * 24;
const DEFAULT_TIMEOUT_MS = 1500;
const DEFAULT_POST_RUN_GRACE_MS = 250;
const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?/;

function isNewerVersion(current: string, latest: string): boolean {
  const c = SEMVER_RE.exec(current.trim());
  const l = SEMVER_RE.exec(latest.trim());
  if (!c || !l) {
    return false;
  }
  for (const i of [1, 2, 3] as const) {
    const diff = Number(l[i]) - Number(c[i]);
    if (diff !== 0) {
      return diff > 0;
    }
  }

  return Boolean(
    c[4] &&
    (!l[4] || l[4].localeCompare(c[4], undefined, { numeric: true }) > 0),
  );
}

function resolveCacheFile(
  pkgName: string,
  env: Readonly<Record<string, string | undefined>>,
  overrideDir?: string,
): string {
  const baseDir =
    [overrideDir, env.XDG_CACHE_HOME].find(Boolean) ??
    join(homedir(), ".cache");
  const safeName = pkgName.replace(/[^\w.-]/g, "_");

  return join(baseDir, "clerc-update-notifier", `${safeName}.json`);
}

async function readCache(filePath: string): Promise<UpdateCache | null> {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as UpdateCache;

    return typeof parsed.lastCheck === "number" ? parsed : null;
  } catch {
    return null;
  }
}

async function writeCache(filePath: string, cache: UpdateCache): Promise<void> {
  try {
    await mkdir(dirname(filePath), { recursive: true });
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

const awaitWithin = <T>(
  promise: Promise<T>,
  graceMs: number,
): Promise<T | undefined> =>
  graceMs <= 0
    ? promise
    : Promise.race([
        promise,
        new Promise<undefined>((resolve) => {
          setTimeout(() => resolve(undefined), graceMs).unref();
        }),
      ]);

export function updateNotifierPlugin(
  options: UpdateNotifierPluginOptions = {},
) {
  const {
    packageName,
    version,
    distTag = "latest",
    checkIntervalMs = DEFAULT_INTERVAL_MS,
    registryUrl = "https://registry.npmjs.org",
    installCommand,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    postRunGraceMs = DEFAULT_POST_RUN_GRACE_MS,
    cacheDir,
    fetch: fetchFn = globalThis.fetch,
    now = () => Date.now(),
  } = options;

  async function checkForUpdate(
    pkgName: string,
    currentVersion: string,
    env: Readonly<Record<string, string | undefined>>,
    isTTY: boolean,
  ): Promise<UpdateInfo | undefined> {
    if (
      !pkgName ||
      !currentVersion ||
      Boolean(env.CI) ||
      Boolean(env.NO_UPDATE_NOTIFIER) ||
      !isTTY
    ) {
      return undefined;
    }

    const cacheFile = resolveCacheFile(pkgName, env, cacheDir);
    const cache = await readCache(cacheFile);
    const currentTime = now();
    let latest = cache?.latest;

    if (!cache || currentTime - cache.lastCheck >= checkIntervalMs) {
      const fetched = await fetchLatestVersion(
        pkgName,
        distTag,
        registryUrl,
        timeoutMs,
        fetchFn,
      );
      if (fetched) {
        latest = fetched;
      }
      await writeCache(cacheFile, { lastCheck: currentTime, latest });
    }

    if (latest && isNewerVersion(currentVersion, latest)) {
      return { name: pkgName, current: currentVersion, latest };
    }

    return undefined;
  }

  return plugin("clerc:update-notifier").middleware(
    async (ctx, next) => {
      const pkgName = packageName ?? ctx.model.meta.name;
      const currentVersion = version ?? ctx.model.meta.version;
      const checkPromise = checkForUpdate(
        pkgName,
        currentVersion,
        ctx.terminal.env,
        ctx.terminal.isTTY,
      );

      try {
        await next();
      } finally {
        const info = await awaitWithin(checkPromise, postRunGraceMs);

        if (info) {
          const updateCmd = installCommand ?? `npm i -g ${info.name}`;
          ctx.log.box.warn(
            `Update available: ${ctx.log.theme.muted(info.current)} → ${ctx.log.theme.success(info.latest)}`,
            `Run ${ctx.log.theme.accent(updateCmd)} to update`,
          );
        }
      }
    },
    { enforce: "pre" },
  );
}
