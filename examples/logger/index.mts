import { setTimeout as delay } from "node:timers/promises";

import { createLogger } from "clerc";

const log = createLogger({ level: "debug" });
const faintRule = (text: string) => log.theme.dim(log.theme.muted(text));

function divider(title: string): void {
  console.log(
    `\n${faintRule("─".repeat(10))} ${log.theme.muted(title)} ${faintRule("─".repeat(10))}\n`,
  );
}

// 1. 统一左脊词标 + 可变详情参数 + node:util inspect + 分层 Error 堆栈
divider("1. Word Labels, Inspect & Layered Error Stack");

log.info("Found 5 build targets", {
  entry: "src/index.ts",
  minify: true,
  sourcemap: false,
});
log.debug("Resolved compiler options", {
  target: "node26",
  isolatedDeclarations: true,
});
log.warn(
  "Deprecated configuration detected",
  "Option '--legacy' will be removed in v3.0",
  "Use '--modern' instead",
);
log.error(
  "Failed to connect to remote cache",
  new Error("connect ECONNREFUSED 127.0.0.1:8787", {
    cause: new Error("cache daemon offline"),
  }),
);

// 2. child() 作用域派生 + 实时延迟流式 .line() 追加
divider("2. Child Scope + Live Delayed .line() Streaming");
const migrateLog = log.child("db").child("migrate");

const migrationStep = migrateLog.step("Running pending migrations");
for (const [file, ms] of [
  ["0001_create_users.sql", 280],
  ["0002_create_sessions.sql", 240],
  ["0003_add_indexes.sql", 300],
] as const) {
  await delay(ms);
  migrationStep.line(`Applied ${file} (${ms}ms)`);
}

// 3. 显式手动控制的 log.spinner() 与自动托管的 log.task()
divider("3. Spinner (Explicit .start) & Task (Auto Lifecycle)");
const spin = log.spinner();
spin.start("Fetching remote build cache...");
await delay(400);
spin.stop("Remote cache hit (14 artifacts)");

await log.task("Building production bundle...", async (s) => {
  await delay(400);
  s.message("Compiling TypeScript declarations...");
  await delay(400);

  return "Production bundle ready in 0.8s";
});

// 4. 与常规日志完全同构的 log.box.{step,info,success,warn,error,debug}
divider("4. Symmetric Boxed Panels (log.box.*)");
log.box.info(
  "Dry run summary",
  "No remote resources were mutated.",
  `Run ${log.theme.accent("acme deploy prod --confirm")} to publish.`,
);
log.box.warn(
  `Update available: ${log.theme.muted("v2.0.0")} → ${log.theme.success("v2.1.0")}`,
  `Run ${log.theme.accent("pnpm up clerc")} to update`,
);

// 5. 纯 ASCII 降级 & 直接属性切换 JSON 模式
divider("5. ASCII Fallback & JSON Mode");
const asciiLog = createLogger({ unicode: false });
asciiLog.child("ci").step("ASCII fallback", "Uses '>' and '|'");
asciiLog.box.info("CI notice", "ASCII border fallback when unicode is off.");

log.format = "json";
log.error("JSON error serialization", new RangeError("Port out of bounds"));
