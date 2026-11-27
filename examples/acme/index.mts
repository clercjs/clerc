import { completions } from "@clerc/plugin-completions";
import { mcp } from "@clerc/plugin-mcp";
import {
  Complete,
  Types,
  atLeastOne,
  cli,
  command,
  exclusive,
  group,
  middleware,
  oneOf,
  together,
  use,
} from "clerc";

// 1. Global config middleware: declares --config and derives typed ctx.state.config
const withConfig = middleware({
  flags: {
    config: {
      type: String,
      short: "c",
      default: "acme.config.ts",
      env: "ACME_CONFIG",
      description: "Path to config file",
      complete: Complete.file("ts", "json"),
    },
  },
  async setup(ctx) {
    return {
      config: await Promise.resolve({
        path: ctx.flags.config,
        loadedAt: new Date().toISOString(),
      }),
    };
  },
});

// 2. Onion timing middleware (logs command duration under -v)
const withTiming = middleware(async (ctx, next) => {
  const start = performance.now();
  try {
    await next();
  } finally {
    const ms = (performance.now() - start).toFixed(1);
    ctx.log.debug(`Command '${ctx.calledAs}' finished in ${ms}ms`);
  }
});

// 3. Database commands: shared db middleware + namespace with default subcommand
const withDb = middleware({
  flags: {
    url: {
      type: Types.String({ trim: true, nonEmpty: true }),
      env: "DATABASE_URL",
      default: "sqlite://./acme.db",
      description: "Database connection URL",
    },
  },
});

const dbMigrate = command("migrate", {
  use: [withDb],
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

const dbSeed = command("seed", {
  use: [withDb],
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

const db = command("db", {
  description: "Database management commands",
  commands: use(withDb, [dbMigrate, dbSeed]),
  default: dbMigrate,
});

// 4. Deployment command: group() + together() + exclusive() + check + unique array flag
const deploy = command("deploy <env> [region]", {
  use: [withConfig],
  aliases: ["d"],
  description: "Deploy application to target environment",
  args: {
    env: {
      type: Types.Enum("staging", "prod"),
      description: "Target environment",
    },
    region: {
      default: "us-east-1",
      description: "Cloud region",
      complete: [
        { value: "us-east-1", description: "US East (N. Virginia)" },
        { value: "eu-west-1", description: "Europe (Ireland)" },
      ],
    },
  },
  flags: [
    group("Network Options", {
      port: {
        type: Types.Integer({ min: 1, max: 65_535 }),
        short: "p",
        default: 3000,
        env: "PORT",
        description: "Server port",
      },
      tls: {
        type: Boolean,
        description: "Enable TLS",
      },
    }),
    group(
      "TLS Options",
      together({
        cert: {
          type: String,
          required: true,
          env: "ACME_TLS_CERT",
          description: "TLS certificate path",
        },
        key: {
          type: String,
          required: true,
          env: "ACME_TLS_KEY",
          description: "TLS private key path",
        },
      }),
    ),
    group(
      "Output Options",
      exclusive(
        { json: { type: Boolean, description: "Format summary as JSON" } },
        { yaml: { type: Boolean, description: "Format summary as YAML" } },
      ),
    ),
    {
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
    },
  ],
  check({ flags }) {
    if (flags.tls && !flags.cert) {
      return "'--tls' requires '--cert' and '--key'";
    }
  },
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

// 5. Format command: exclusive() + check across <files...> and --stdin
const format = command("format [files...]", {
  description: "Format source files or stdin",
  args: {
    files: {
      unique: true,
      description: "Files to format",
    },
  },
  flags: [
    {
      stdin: {
        type: Boolean,
        description: "Read input from stdin",
      },
      ratio: {
        type: Types.Number({ min: 0, max: 1 }),
        description: "Formatting heuristic threshold",
      },
    },
    exclusive(
      {
        write: {
          type: Boolean,
          short: "w",
          description: "Write formatted output back to files",
        },
      },
      {
        check: {
          type: Boolean,
          description: "Exit non-zero if formatting changes are needed",
        },
      },
    ),
  ],
  check({ flags, provided }) {
    const hasFiles = provided.args.has("files");
    const hasStdin = provided.flags.has("stdin");
    if (hasFiles === hasStdin) {
      return {
        message: "pass either '<files...>' or '--stdin'",
        hints: ["pass one or more <files...> or use '--stdin'"],
      };
    }
    if (flags.stdin && flags.write) {
      return "'--stdin' and '--write' cannot be used together";
    }
  },
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

// 6. Scoped cloud auth middleware: oneOf() discriminated union narrowing + setup()
const cloudAuth = middleware({
  use: [withConfig],
  flags: group("Authentication", [
    {
      server: {
        type: Types.String({ trim: true, nonEmpty: true }),
        placeholder: "<url>",
        env: "ACME_SERVER",
        default: "https://api.acme.dev",
        description: "Cloud hub URL",
      },
    },
    oneOf(
      {
        token: {
          type: Types.String({ trim: true, nonEmpty: true }),
          required: true,
          placeholder: "<token>",
          env: "ACME_TOKEN",
          description: "API Bearer token",
        },
      },
      {
        tokenFile: {
          type: Types.String({ trim: true, nonEmpty: true }),
          required: true,
          placeholder: "<path>",
          env: "ACME_TOKEN_FILE",
          description: "File containing API Bearer token",
        },
      },
    ),
  ]),
  setup(ctx) {
    // Discriminated union narrows ctx.flags.tokenFile to string when token is undefined!
    const source = ctx.flags.token
      ? "inline-token"
      : `file:${ctx.flags.tokenFile}`;

    return {
      cloudAuth: {
        server: ctx.flags.server,
        source,
      },
    };
  },
});

const monitorLs = command("ls", {
  use: [cloudAuth],
  description: "List all monitors",
  run(ctx) {
    ctx.log.info(
      `Listing monitors from ${ctx.state.cloudAuth.server} (${ctx.state.cloudAuth.source})`,
    );
  },
});

const monitorEdit = command("edit <id>", {
  use: [cloudAuth],
  description: "Update fields of an existing HTTP monitor",
  args: {
    id: { description: "Monitor identifier" },
  },
  flags: group(
    "Monitor Fields",
    atLeastOne({
      name: {
        type: Types.String({ trim: true, nonEmpty: true }),
        description: "Display name",
      },
      url: {
        type: Types.String({ trim: true, nonEmpty: true }),
        description: "Probe URL",
      },
      method: {
        type: Types.Enum("GET", "HEAD", "POST"),
        description: "HTTP probe method",
      },
      statusMin: {
        type: Types.Integer({ min: 100, max: 599 }),
        description: "Minimum accepted HTTP status code",
      },
      statusMax: {
        type: Types.Integer({ min: 100, max: 599 }),
        description: "Maximum accepted HTTP status code",
      },
      interval: {
        type: Types.Integer({ min: 10, max: 86_400 }),
        description: "Probe interval in seconds",
      },
      timeout: {
        type: Types.Integer({ min: 500, max: 30_000 }),
        description: "Probe timeout in milliseconds",
      },
    }),
  ),
  check: {
    description: "--status-max must be >= --status-min",
    validate({ flags }) {
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

const monitorOrder = command("order <ids...>", {
  use: [cloudAuth],
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

const monitor = command("monitor", {
  aliases: ["mon"],
  description: "Manage HTTP monitors",
  commands: [monitorLs, monitorEdit, monitorOrder],
  default: monitorLs,
});

// 7. Utility commands
const execCmd = command("exec <cmd> -- [args...]", {
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

const legacy = command("legacy", {
  deprecated: "use 'acme deploy' instead",
  description: "Deprecated deployment helper",
  run(ctx) {
    ctx.log.info("Running legacy path...");
  },
});

// 8. Assemble CLI with lexical groups, scoped middlewares, completions(), and mcp()
const app = cli({
  name: "acme",
  version: "2.0.0",
  description: "Build and deploy modern TypeScript apps (Clerc v2 demo)",
  examples: [
    ["$ acme deploy prod --port 8080 -n", "Preview a production deploy"],
    ["$ acme db migrate -s 2", "Apply the next 2 database migrations"],
    [
      "$ acme monitor edit web --token tok --status-min 200 --status-max 299",
      "Edit monitor fields with group + range check",
    ],
    ["$ acme format --stdin", "Format input from stdin"],
    ["$ acme mcp", "Start an MCP stdio server exposing all commands"],
  ],
  notes: [
    "Pass -v for debug timing logs, or -q for quiet mode.",
    "Try violating constraints (e.g. 'acme deploy prod --json --yaml', 'acme deploy prod --tls', 'acme monitor edit web --token tok') to see diagnostics.",
  ],
  use: [withConfig, withTiming],
  commands: [
    group("Deployment", [deploy, format]),
    group("Database", [db]),
    group("Cloud", use(cloudAuth, [monitor])),
    execCmd,
    legacy,
    completions(),
    mcp(),
  ],
});

await app.runMain();
