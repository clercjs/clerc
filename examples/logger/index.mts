import { setTimeout as delay } from "node:timers/promises";

import { createLogger, createTheme, monoThemeStyles } from "clerc";

const theme = createTheme(true);
const faintDivider = (text: string) => theme.dim(theme.muted(text));

function divider(title: string): void {
  console.log(
    `\n${faintDivider("─".repeat(10))} ${theme.muted(title)} ${faintDivider("─".repeat(10))}\n`,
  );
}

// 1. 统一左脊词标 + node:util inspect + 分层 Error 堆栈
divider("1. Word Labels, Inspect & Layered Error Stack");
const log = createLogger({ level: "debug" });

log.info("Found 5 build targets", {
  entry: "src/index.ts",
  minify: true,
  sourcemap: false,
});
log.debug("Resolved compiler options", {
  target: "node26",
  isolatedDeclarations: true,
});
log.warn("Deprecated option '--legacy' detected", "Use '--modern' instead");
log.error(
  "Failed to connect to remote cache",
  new Error("connect ECONNREFUSED 127.0.0.1:8787", {
    cause: new Error("cache daemon offline"),
  }),
);

// 2. withScope 作用域嵌套 + 实时延迟流式 .line() 追加
divider("2. Scoped Logger + Live Delayed .line() Streaming");
const migrateLog = log.withScope("db").withScope("migrate");

const migrationStep = migrateLog.step("Running pending migrations");
for (const [file, ms] of [
  ["0001_create_users.sql", 280],
  ["0002_create_sessions.sql", 240],
  ["0003_add_indexes.sql", 300],
] as const) {
  await delay(ms);
  migrationStep.line(`Applied ${file} (${ms}ms)`);
}

// 3. Clack Spinner（对齐第 7 列网格 + @clerc/theme 品牌色，完成后收敛为 done）
divider("3. Clack Spinner (Unified Theme & 7-Col Grid)");
const spin = log.spinner();
spin.start("Building production bundle...");
await delay(500);
spin.message("Compiling TypeScript declarations...");
await delay(500);
spin.stop("Production bundle ready in 1.0s");

// 4. Clack Note 面板（对齐第 7 列网格 + 语义色左标 + 层次化框线/正文）
divider("4. Clack Boxed Note Panel (Semantic Tones & Grid)");
log.note(
  `No remote resources were mutated.\nRun ${theme.accent("acme deploy prod --confirm")} to publish.`,
  "Dry run summary",
);
log.note(
  `Run ${theme.accent("pnpm up clerc")} to update`,
  `Update available: ${theme.muted("v2.0.0")} → ${theme.success("v2.1.0")}`,
  { tone: "warn" },
);

// 5. Compact 样式 & ASCII / Mono 降级 & JSON 模式
divider("5. Compact Style, ASCII Mono & JSON Mode");
const asciiMonoLog = createLogger({
  unicode: false,
  theme: createTheme(true, monoThemeStyles),
});
asciiMonoLog.withScope("ci").step("ASCII fallback", "Uses '>' and '|'");
asciiMonoLog.note("ASCII border fallback when unicode is off.", "CI notice");

log.setFormat("json");
log.error("JSON error serialization", new RangeError("Port out of bounds"));
