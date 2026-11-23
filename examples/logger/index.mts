import { createLogger, createTheme, monoThemeStyles } from "clerc";

function divider(title: string): void {
  console.log(`\n${"─".repeat(14)} ${title} ${"─".repeat(14)}\n`);
}

// 1. 默认左对齐词标 + 正文列内缩导轨（rail）
divider("1. Default Rail Style & All Log Kinds");
const log = createLogger({ level: "debug" });

log.step(
  "Resolving workspace packages",
  "packages/theme\npackages/logger\npackages/clerc",
);
log.info("Found 5 build targets");
log.debug("Compiler flags: --target=node26 --minify");
log.warn("Deprecated option '--legacy' detected", "Use '--modern' instead");
log.error(
  "Failed to connect to remote cache",
  "ECONNREFUSED 127.0.0.1:8787\nRetrying locally...",
);
log.success("Build finished", "total: 580ms");

// 2. withScope 作用域嵌套（清晰三层亮度：标签 / scope › / 正文 & debug）
divider("2. Scoped Loggers (withScope)");
const dbLog = log.withScope("db");
const migrateLog = dbLog.withScope("migrate");

dbLog.info("Connected to SQLite");
migrateLog.step("Applying 0004_init.sql", "3 tables created");
migrateLog.debug("Query took 1.2ms");

// 3. 全部 4 种 Callout 语气
divider("3. Callout Tones");
log.callout({
  tone: "info",
  title: "Dry run preview",
  lines: ["No remote resources will be mutated.", "Pass --confirm to apply."],
});
log.callout({
  tone: "warn",
  title: "Update available: v2.0.0 → v2.1.0",
  lines: ["Run pnpm up clerc to update"],
});
log.callout({
  tone: "error",
  title: "Health check failed",
  lines: ["2 of 3 replicas returned HTTP 503"],
});
log.callout({
  tone: "success",
  title: "Release v2.1.0 published",
  lines: ["https://npmjs.com/package/@clerc/logger"],
});

// 4. Compact 无竖线缩进样式 & ASCII / Mono 降级
divider("4. Compact Style & ASCII Mono Fallback");
log.setStyle("compact");
log.step("Compact style (no rail bar)", "packages/theme\npackages/logger");

const asciiMonoLog = createLogger({
  level: "debug",
  unicode: false,
  theme: createTheme(true, monoThemeStyles),
});
asciiMonoLog.withScope("ci").step("ASCII fallback", "Uses '>' and '|'");

// 5. JSON 结构化输出模式
divider("5. Structured JSON Format");
log.setFormat("json");
log.info("Server listening", "http://localhost:3000");
migrateLog.success("Migrations complete");
