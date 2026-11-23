import { completionsPlugin } from "@clerc/plugin-completions";
import { mcpPlugin } from "@clerc/plugin-mcp";
import { Types, clerc, plugin, verbosityPlugin } from "clerc";

// 1. Custom plugin with global flag + async context derivation
const configPlugin = plugin("acme:config")
  .flags({
    config: {
      type: String,
      short: "c",
      default: "acme.config.ts",
      env: "ACME_CONFIG",
      description: "Path to config file",
    },
  })
  .extend(async (ctx) => ({
    config: await Promise.resolve({
      path: ctx.flags.config,
      loadedAt: new Date().toISOString(),
    }),
  }));

// 2. Custom onion middleware plugin (logs timing under -v)
const timingPlugin = plugin("acme:timing").middleware(async (ctx, next) => {
  const start = performance.now();
  try {
    await next();
  } finally {
    const ms = (performance.now() - start).toFixed(1);
    ctx.log.debug(`Command '${ctx.calledAs}' finished in ${ms}ms`);
  }
});

// 3. Modular subcommand namespace as a plugin
const dbPlugin = plugin("acme:db")
  .command("db", {
    group: "db",
    description: "Database management commands",
  })
  .command("db migrate", {
    aliases: "m",
    group: "db",
    description: "Run pending database migrations",
    flags: {
      steps: {
        type: Types.Integer,
        short: "s",
        description: "Number of migrations to apply",
      },
      dryRun: { type: Boolean, short: "n", description: "Preview SQL only" },
    },
    meta: { mcp: { idempotent: true } },
    run(ctx) {
      ctx.log.step(
        "Running database migrations",
        `steps: ${ctx.flags.steps ?? "all"}`,
      );
      if (ctx.flags.dryRun) {
        ctx.log.info("Dry run enabled - no schema changes applied.");
      } else {
        ctx.log.success("Database is up to date!");
      }
    },
  })
  .command("db seed", {
    group: "db",
    description: "Seed development data",
    flags: {
      reset: { type: Boolean, description: "Truncate tables before seeding" },
    },
    meta: { mcp: { destructive: true } },
    run(ctx) {
      ctx.log.step("Seeding database", `reset: ${String(ctx.flags.reset)}`);
      ctx.log.success("Inserted 42 sample records.");
    },
  });

// 4. Assemble CLI
const cli = clerc({
  name: "acme",
  version: "2.0.0",
  description: "Build and deploy modern TypeScript apps (Clerc v2 demo)",
  examples: [
    ["$ acme deploy prod --port 8080 -n", "Preview a production deploy"],
    ["$ acme db migrate -s 2", "Apply the next 2 database migrations"],
    ["$ acme mcp", "Start an MCP stdio server exposing all commands"],
  ],
  notes: [
    "Pass -v for debug timing logs, or -q for quiet mode.",
    "Try a typo like 'acme deply' or 'acme deploy prod --prt 80' to see diagnostics.",
  ],
})
  .groups({
    commands: { deploy: "Deployment", db: "Database" },
    flags: { network: "Network Options", output: "Output Options" },
  })
  .use(verbosityPlugin())
  .use(configPlugin)
  .use(timingPlugin)
  .use(dbPlugin)
  .use(completionsPlugin())
  .use(mcpPlugin());

cli.command("deploy <env> [region]", {
  aliases: ["d"],
  group: "deploy",
  description: "Deploy application to target environment",
  args: {
    env: {
      type: Types.Enum("staging", "prod"),
      description: "Target environment",
    },
    region: {
      description: "Cloud region (defaults to us-east-1)",
    },
  },
  flags: {
    port: {
      type: Types.Range(1, 65_535),
      short: "p",
      default: 3000,
      env: "PORT",
      group: "network",
      description: "Server port",
    },
    dryRun: {
      type: Boolean,
      short: "n",
      description: "Preview without deploying",
    },
    cache: {
      type: Boolean,
      default: true,
      description: "Use build cache",
    },
    tags: {
      type: [String],
      short: "t",
      description: "Release tags (repeatable)",
    },
    json: {
      type: Boolean,
      conflicts: "yaml",
      group: "output",
      description: "Format summary as JSON",
    },
    yaml: {
      type: Boolean,
      group: "output",
      description: "Format summary as YAML",
    },
  },
  examples: [
    ["$ acme deploy staging", "Deploy to staging with defaults"],
    [
      "$ acme deploy prod eu-west-1 -p 8080 -t v2 -t latest",
      "Tagged prod deploy",
    ],
  ],
  meta: { mcp: { destructive: true } },
  run(ctx) {
    const summary = {
      env: ctx.args.env,
      region: ctx.args.region ?? "us-east-1",
      port: ctx.flags.port,
      cache: ctx.flags.cache,
      dryRun: ctx.flags.dryRun,
      tags: ctx.flags.tags,
      config: ctx.config.path,
    };

    if (ctx.flags.json) {
      ctx.log.raw(JSON.stringify(summary, null, 2));

      return;
    }
    if (ctx.flags.yaml) {
      const lines = Object.entries(summary).map(
        ([k, v]) =>
          `${k}: ${Array.isArray(v) ? `[${v.join(", ")}]` : String(v)}`,
      );
      ctx.log.raw(lines.join("\n"));

      return;
    }

    ctx.log.debug(
      `Loaded config from ${ctx.config.path} (${ctx.config.loadedAt})`,
    );
    ctx.log.step(
      `Deploying to ${summary.env} (${summary.region})`,
      `port=${summary.port}, cache=${String(summary.cache)}`,
    );

    if (summary.tags.length > 0) {
      ctx.log.info(`Tags: ${summary.tags.join(", ")}`);
    }

    if (summary.dryRun) {
      ctx.log.box.info(
        "Dry run complete",
        "No remote resources were modified.",
      );
    } else {
      ctx.log.success(`Deployed ${summary.env} successfully!`);
    }
  },
});

cli.command("exec <cmd> -- [args...]", {
  description: "Run a subcommand with forwarded arguments after --",
  args: {
    cmd: { description: "Executable name" },
    args: { description: "Arguments forwarded verbatim" },
  },
  run(ctx) {
    ctx.log.info(`cmd=${ctx.args.cmd}`);
    ctx.log.info(`args=${JSON.stringify(ctx.args.args)}`);
  },
});

cli.command("legacy", {
  deprecated: "use 'acme deploy' instead",
  description: "Deprecated deployment helper",
  run(ctx) {
    ctx.log.info("Running legacy path...");
  },
});

await cli.runMain();
