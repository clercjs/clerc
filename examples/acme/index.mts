import { completionsPlugin } from "@clerc/plugin-completions";
import { mcpPlugin } from "@clerc/plugin-mcp";
import { Types, clerc, plugin } from "clerc";

// 1. Custom plugin with global flag + async context derivation
const configPlugin = plugin("acme:config")
  .flags({
    config: {
      type: String,
      short: "c",
      default: "acme.config.ts",
      env: "ACME_CONFIG",
      description: "Path to config file",
      complete: () => ({ files: ["ts", "json"] }),
    },
  })
  .middleware(async (ctx, next) =>
    next({
      config: await Promise.resolve({
        path: ctx.flags.config,
        loadedAt: new Date().toISOString(),
      }),
    }),
  );

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

// 3. Modular subcommand namespace as a plugin (scoped flags + default subcommand)
const dbPlugin = plugin("acme:db");
const db = dbPlugin
  .subcommand("db", {
    group: "db",
    description: "Database management commands",
  })
  .flags({
    url: {
      type: Types.String({ trim: true, nonEmpty: true }),
      env: "DATABASE_URL",
      default: "sqlite://./acme.db",
      description: "Database connection URL",
    },
  });

db.command("migrate", {
  default: true,
  aliases: "m",
  description: "Run pending database migrations",
  flags: {
    steps: {
      type: Types.Integer({ min: 1 }),
      short: "s",
      description: "Number of migrations to apply",
    },
    dryRun: { type: Boolean, short: "n", description: "Preview SQL only" },
  },
  meta: { mcp: { idempotent: true } },
  run(ctx) {
    ctx.log.step(
      `Running database migrations on ${ctx.flags.url}`,
      `steps: ${ctx.flags.steps ?? "all"}`,
    );
    if (ctx.flags.dryRun) {
      ctx.log.info("Dry run enabled - no schema changes applied.");
    } else {
      ctx.log.success("Database is up to date!");
    }
  },
});

db.command("seed", {
  description: "Seed development data",
  flags: {
    reset: { type: Boolean, description: "Truncate tables before seeding" },
  },
  meta: { mcp: { destructive: true } },
  run(ctx) {
    ctx.log.step(
      `Seeding ${ctx.flags.url}`,
      `reset: ${String(ctx.flags.reset)}`,
    );
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
    [
      "$ acme monitor edit web --token tok --status-min 200 --status-max 299",
      "Edit monitor fields with group + range rules",
    ],
    ["$ acme format --stdin", "Format input from stdin"],
    ["$ acme mcp", "Start an MCP stdio server exposing all commands"],
  ],
  notes: [
    "Pass -v for debug timing logs, or -q for quiet mode.",
    "Try violating rules (e.g. 'acme deploy prod --json --yaml', 'acme deploy prod --tls', 'acme monitor edit web --token tok') to see diagnostics.",
  ],
})
  .groups({
    commands: { deploy: "Deployment", cloud: "Cloud", db: "Database" },
    flags: {
      network: "Network Options",
      tls: "TLS Options",
      output: "Output Options",
      auth: "Authentication",
      fields: "Monitor Fields",
    },
  })
  .use(configPlugin)
  .use(timingPlugin)
  .use(dbPlugin)
  .use(completionsPlugin())
  .use(mcpPlugin());

// 5. Deployment command: exclusive + requires + together + r.group() + unique array flag
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
      default: "us-east-1",
      description: "Cloud region",
      complete: () => [
        { value: "us-east-1", description: "US East (N. Virginia)" },
        { value: "eu-west-1", description: "Europe (Ireland)" },
      ],
    },
  },
  flags: {
    port: {
      type: Types.Integer({ min: 1, max: 65_535 }),
      short: "p",
      default: 3000,
      env: "PORT",
      group: "network",
      description: "Server port",
    },
    tls: {
      type: Boolean,
      group: "network",
      description: "Enable TLS",
    },
    cert: {
      type: String,
      group: "tls",
      env: "ACME_TLS_CERT",
      description: "TLS certificate path",
    },
    key: {
      type: String,
      group: "tls",
      env: "ACME_TLS_KEY",
      description: "TLS private key path",
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
      type: String,
      multiple: true,
      unique: true,
      short: "t",
      description: "Release tags",
    },
    json: {
      type: Boolean,
      group: "output",
      description: "Format summary as JSON",
    },
    yaml: {
      type: Boolean,
      group: "output",
      description: "Format summary as YAML",
    },
  },
  rules: (r) => [
    r.exclusive(r.flag("json"), r.flag("yaml")),
    r.together(r.group("tls")),
    r.requires(r.flag("tls"), r.group("tls")),
  ],
  examples: [
    ["$ acme deploy staging", "Deploy to staging with defaults"],
    [
      "$ acme deploy prod eu-west-1 -p 8080 -t v2 -t latest",
      "Tagged prod deploy",
    ],
    [
      "$ acme deploy prod --tls --cert cert.pem --key key.pem",
      "TLS-enabled deploy",
    ],
  ],
  meta: { mcp: { destructive: true } },
  run(ctx) {
    const summary = {
      env: ctx.args.env,
      region: ctx.args.region,
      port: ctx.flags.port,
      tls: ctx.flags.tls,
      cache: ctx.flags.cache,
      dryRun: ctx.flags.dryRun,
      tags: ctx.flags.tags,
      config: ctx.state.config.path,
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
      `Loaded config from ${ctx.state.config.path} (${ctx.state.config.loadedAt})`,
    );
    ctx.log.step(
      `Deploying to ${summary.env} (${summary.region})`,
      `port=${summary.port}, tls=${String(summary.tls)}, cache=${String(summary.cache)}`,
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

// 6. Format command: flag + arg oneOf with custom hints, exclusive, and numeric float range
cli.command("format [files...]", {
  group: "deploy",
  description: "Format source files or stdin",
  args: {
    files: {
      unique: true,
      description: "Files to format",
    },
  },
  flags: {
    stdin: {
      type: Boolean,
      description: "Read input from stdin",
    },
    write: {
      type: Boolean,
      short: "w",
      description: "Write formatted output back to files",
    },
    check: {
      type: Boolean,
      description: "Exit non-zero if formatting changes are needed",
    },
    ratio: {
      type: Types.Number({ min: 0, max: 1 }),
      description: "Formatting heuristic threshold",
    },
  },
  rules: (r) => [
    r.oneOf([r.arg("files"), r.flag("stdin")], {
      hints: ["pass one or more <files...> or use '--stdin'"],
    }),
    r.exclusive(r.flag("write"), r.flag("check")),
    r.exclusive(r.flag("stdin"), r.flag("write")),
  ],
  examples: [
    ["$ acme format src/index.ts --write", "Format files in place"],
    ["$ acme format --stdin --check", "Check stdin formatting"],
  ],
  run(ctx) {
    const source = ctx.flags.stdin
      ? "stdin"
      : `${ctx.args.files.length} file(s): ${ctx.args.files.join(", ")}`;
    const mode = ctx.flags.write
      ? "write"
      : ctx.flags.check
        ? "check"
        : "stdout";
    ctx.log.success(`Formatted ${source} (mode=${mode})`);
  },
});

// 7. Scoped cloud commands: shared auth flags + oneOf (with auto env hints) + scoped middleware
const cloud = cli
  .scope({ group: "cloud" })
  .flags({
    server: {
      type: Types.String({ trim: true, nonEmpty: true }),
      placeholder: "<url>",
      env: "ACME_SERVER",
      default: "https://api.acme.dev",
      group: "auth",
      description: "Cloud hub URL",
    },
    token: {
      type: Types.String({ trim: true, nonEmpty: true }),
      placeholder: "<token>",
      env: "ACME_TOKEN",
      group: "auth",
      description: "API Bearer token",
    },
    tokenFile: {
      type: Types.String({ trim: true, nonEmpty: true }),
      placeholder: "<path>",
      env: "ACME_TOKEN_FILE",
      group: "auth",
      description: "File containing API Bearer token",
    },
  })
  .rules((r) => [r.oneOf(r.flag("token"), r.flag("tokenFile"))])
  .middleware((ctx, next) =>
    next({
      cloudAuth: {
        server: ctx.flags.server,
        source: ctx.flags.token
          ? "inline-token"
          : `file:${ctx.flags.tokenFile}`,
      },
    }),
  );

const monitor = cloud.subcommand("monitor", {
  aliases: ["mon"],
  description: "Manage HTTP monitors",
});

monitor.command("ls", {
  default: true,
  description: "List all monitors",
  run(ctx) {
    ctx.log.info(
      `Listing monitors from ${ctx.state.cloudAuth.server} (${ctx.state.cloudAuth.source})`,
    );
  },
});

// Showcases r.atLeastOne(r.group("fields")), composable rules array, and documented custom rule with detail + hints
monitor.command("edit <id>", {
  description: "Update fields of an existing HTTP monitor",
  args: {
    id: { description: "Monitor identifier" },
  },
  flags: {
    name: {
      type: Types.String({ trim: true, nonEmpty: true }),
      group: "fields",
      description: "Display name",
    },
    url: {
      type: Types.String({ trim: true, nonEmpty: true }),
      group: "fields",
      description: "Probe URL",
    },
    method: {
      type: Types.Enum("GET", "HEAD", "POST"),
      group: "fields",
      description: "HTTP probe method",
    },
    statusMin: {
      type: Types.Integer({ min: 100, max: 599 }),
      group: "fields",
      description: "Minimum accepted HTTP status code",
    },
    statusMax: {
      type: Types.Integer({ min: 100, max: 599 }),
      group: "fields",
      description: "Maximum accepted HTTP status code",
    },
    interval: {
      type: Types.Integer({ min: 10, max: 86_400 }),
      group: "fields",
      description: "Probe interval in seconds",
    },
    timeout: {
      type: Types.Integer({ min: 500, max: 30_000 }),
      group: "fields",
      description: "Probe timeout in milliseconds",
    },
  },
  rules: [
    (r) => [r.atLeastOne(r.group("fields"))],
    {
      description: "--status-max must be >= --status-min",
      check({ flags }) {
        if (
          flags.statusMin !== undefined &&
          flags.statusMax !== undefined &&
          flags.statusMax < flags.statusMin
        ) {
          return {
            message: "'--status-max' must be >= '--status-min'",
            detail: `received status-min=${flags.statusMin}, status-max=${flags.statusMax}`,
            hints: [
              `try '--status-min ${flags.statusMax} --status-max ${flags.statusMin}'`,
            ],
          };
        }
      },
    },
  ],
  run(ctx) {
    ctx.log.success(
      `Updated monitor '${ctx.args.id}' on ${ctx.state.cloudAuth.server}`,
      {
        name: ctx.flags.name,
        url: ctx.flags.url,
        method: ctx.flags.method,
        statusMin: ctx.flags.statusMin,
        statusMax: ctx.flags.statusMax,
        interval: ctx.flags.interval,
        timeout: ctx.flags.timeout,
      },
    );
  },
});

// Showcases array-level constraints (unique + minItems + maxItems) on variadic args
monitor.command("order <ids...>", {
  description: "Set display order for monitors",
  args: {
    ids: {
      unique: true,
      minItems: 2,
      maxItems: 10,
      description: "Ordered monitor identifiers",
    },
  },
  run(ctx) {
    ctx.log.success(
      `Reordered ${ctx.args.ids.length} monitors on ${ctx.state.cloudAuth.server}: ${ctx.args.ids.join(" -> ")}`,
    );
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
