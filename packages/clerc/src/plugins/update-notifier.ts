import { plugin } from "@clerc/core";

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
  readonly forceCheckInCI?: boolean;
}

interface UpdateCache {
  readonly lastCheck: number;
  readonly latest?: string;
}

const DEFAULT_INTERVAL_MS = 1000 * 60 * 60 * 24;
const DEFAULT_TIMEOUT_MS = 1500;
const DEFAULT_POST_RUN_GRACE_MS = 250;
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

async function resolveCacheFile(
  pkgName: string,
  env: Readonly<Record<string, string | undefined>>,
  overrideDir?: string,
): Promise<string> {
  const [os, path] = await Promise.all([
    import("node:os"),
    import("node:path"),
  ]);
  const baseDir =
    overrideDir ?? env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache");
  const safeName = pkgName.replace(/[^\w.-]/g, "_");

  return path.join(baseDir, "clerc-update-notifier", `${safeName}.json`);
}

async function readCache(filePath: string): Promise<UpdateCache | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as UpdateCache;

    return typeof parsed.lastCheck === "number" ? parsed : null;
  } catch {
    return null;
  }
}

async function writeCache(filePath: string, cache: UpdateCache): Promise<void> {
  try {
    const [{ mkdir, writeFile }, path] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);
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

function awaitWithin<T>(
  promise: Promise<T>,
  graceMs: number,
): Promise<T | undefined> {
  if (graceMs <= 0) {
    return promise;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    promise.finally(() => {
      if (timer) {
        clearTimeout(timer);
      }
    }),
    new Promise<undefined>((resolve) => {
      timer = setTimeout(() => resolve(undefined), graceMs);
      timer.unref();
    }),
  ]);
}

export function updateNotifierPlugin(options: UpdateNotifierPluginOptions) {
  const {
    pkg,
    distTag = "latest",
    checkIntervalMs = DEFAULT_INTERVAL_MS,
    registryUrl = "https://registry.npmjs.org",
    installCommand = `npm i -g ${pkg.name}`,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    postRunGraceMs = DEFAULT_POST_RUN_GRACE_MS,
    cacheDir,
    fetch: fetchFn = globalThis.fetch,
    now = () => Date.now(),
    forceCheckInCI = false,
  } = options;

  async function checkForUpdate(
    env: Readonly<Record<string, string | undefined>>,
    isTTY: boolean,
  ): Promise<UpdateInfo | undefined> {
    if (
      !forceCheckInCI &&
      (Boolean(env.CI) || Boolean(env.NO_UPDATE_NOTIFIER) || !isTTY)
    ) {
      return undefined;
    }

    const cacheFile = await resolveCacheFile(pkg.name, env, cacheDir);
    const cache = await readCache(cacheFile);
    const currentTime = now();
    let latest = cache?.latest;

    if (!cache || currentTime - cache.lastCheck >= checkIntervalMs) {
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
      await writeCache(cacheFile, { lastCheck: currentTime, latest });
    }

    if (latest && isNewerVersion(pkg.version, latest)) {
      return { name: pkg.name, current: pkg.version, latest };
    }

    return undefined;
  }

  return plugin("clerc:update-notifier").middleware(async (ctx, next) => {
    const checkPromise = checkForUpdate(ctx.terminal.env, ctx.terminal.isTTY);

    try {
      await next();
    } finally {
      const info = await awaitWithin(checkPromise, postRunGraceMs);

      if (info) {
        ctx.log.callout({
          tone: "warn",
          title: `Update available: ${ctx.theme.muted(info.current)} → ${ctx.theme.success(info.latest)}`,
          lines: [`Run ${ctx.theme.accent(installCommand)} to update`],
        });
      }
    }
  });
}
