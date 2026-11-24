import type { Clerc } from "../../../packages/clerc/src/cli.ts";
import { clerc, plugin } from "../../../packages/clerc/src/cli.ts";
import { ClercError } from "../../../packages/clerc/src/errors.ts";
import { Types } from "../../../packages/clerc/src/schema.ts";
import { createMemoryTerminal } from "../../../packages/clerc/src/terminal.ts";
import type {
  CliModel,
  CommandNode,
  TypeFunction,
} from "../../../packages/clerc/src/types.ts";
import { kebabCase } from "../../../packages/clerc/src/utils.ts";
import { createMcpHandler } from "../../../packages/plugin-mcp/src/protocol.ts";
import type { TerminalBlock } from "./terminal-render.ts";
import { parseAnsiLines } from "./terminal-render.ts";

Error.isError ??= (val: unknown): val is Error => val instanceof Error;

export type ScenarioId =
  | "default"
  | "commands"
  | "arguments"
  | "flags"
  | "types"
  | "middleware"
  | "plugins"
  | "diagnostics"
  | "logger"
  | "completions"
  | "mcp"
  | "testing";

export interface PlaygroundScenario {
  readonly createCli: () => Clerc<any, any>;
  readonly source: string;
  readonly presets: readonly {
    readonly cmd: string;
    readonly label?: string;
  }[];
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export function tokenizeArgv(raw: string, binName: string): string[] {
  const prefixRe = new RegExp(`^(?:\\$\\s*)?(?:${binName}\\b\\s*)?`);
  const cleaned = raw.trim().replace(prefixRe, "");
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;

  for (const ch of cleaned) {
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

export async function runScenarioCli(
  scenario: PlaygroundScenario,
  rawInput: string,
): Promise<{
  readonly exitCode: number;
  readonly blocks: readonly TerminalBlock[];
}> {
  const cli = scenario.createCli();
  const binName = cli.buildModel().meta.name;
  const argv = tokenizeArgv(rawInput, binName);
  const terminal = createMemoryTerminal({
    color: true,
    unicode: true,
    columns: 68,
    env: scenario.env,
  });

  const result = await cli.run(argv, { terminal });
  const rawLines = [...terminal.stdoutLines, ...terminal.stderrLines].flatMap(
    (chunk) => chunk.split("\n"),
  );

  return {
    exitCode: result.exitCode,
    blocks:
      rawLines.length > 0
        ? parseAnsiLines(rawLines)
        : [
            {
              kind: "line",
              spans: [{ text: "(no output)", cls: "t-faint" }],
            },
          ],
  };
}

export function computeModelGhostSuffix(model: CliModel, raw: string): string {
  if (raw.length === 0 || raw.endsWith(" ")) {
    return "";
  }
  const parts = raw.trimStart().split(/\s+/);
  const last = parts.at(-1) ?? "";
  if (last.length === 0) {
    return "";
  }

  const prior = parts.slice(0, -1);
  let node: CommandNode = model.tree.root;
  let posCount = 0;

  if (prior[0] === "help") {
    for (const word of prior.slice(1)) {
      const next = node.children.get(word) ?? node.aliasIndex.get(word);
      if (!next) {
        break;
      }
      node = next;
    }
    const subCandidates = model.tree
      .listVisibleChildren(node)
      .filter((c) => c.name !== "help")
      .map((c) => c.name);
    const hit = subCandidates.find((c) => c.startsWith(last) && c !== last);

    return hit ? hit.slice(last.length) : "";
  }

  for (const word of prior) {
    if (word === "--") {
      break;
    }
    if (word.startsWith("-")) {
      continue;
    }
    const child = node.children.get(word) ?? node.aliasIndex.get(word);
    if (child && posCount === 0) {
      node = child;
    } else {
      posCount += 1;
    }
  }

  let effectiveNode = node;
  if (
    node === model.tree.root &&
    model.defaultCommand &&
    (posCount > 0 || last.startsWith("-"))
  ) {
    effectiveNode = model.tree.findNode(model.defaultCommand) ?? node;
  }

  const candidates: string[] = [];

  if (last.startsWith("-")) {
    const allFlags = [
      ...effectiveNode.localFlags,
      ...model.globalFlags,
      ...effectiveNode.builtinFlags,
    ];
    const seen = new Set<string>();
    for (const f of allFlags) {
      if (f.hidden || seen.has(f.name)) {
        continue;
      }
      seen.add(f.name);
      const kebab = kebabCase(f.name);
      const needsVal =
        (f.kind === "single" || f.kind === "array") &&
        f.implicitValue === undefined;
      candidates.push(`--${kebab}${needsVal ? " " : ""}`);
      if (f.negatable && f.default === true) {
        candidates.push(`--no-${kebab}`);
      }
    }
  } else {
    if (posCount === 0 && node.children.size > 0) {
      for (const child of model.tree.listVisibleChildren(node)) {
        candidates.push(`${child.name} `);
      }
    }
    const prevWord = prior.at(-1);
    if (prevWord?.startsWith("-")) {
      const allFlags = [...effectiveNode.localFlags, ...model.globalFlags];
      const matchedFlag = allFlags.find(
        (f) =>
          `--${kebabCase(f.name)}` === prevWord ||
          (f.short && `-${f.short}` === prevWord),
      );
      if (typeof matchedFlag?.complete === "function") {
        const res = matchedFlag.complete({
          word: last,
          words: parts,
          wordIndex: parts.length - 1,
          command: effectiveNode,
          args: {},
          flags: {},
          model,
        } as never);
        if (Array.isArray(res)) {
          for (const item of res) {
            const val = typeof item === "string" ? item : item.value;
            candidates.push(`${val} `);
          }
        }
      }
    }

    const argDesc =
      effectiveNode.args[
        Math.min(posCount, Math.max(0, effectiveNode.args.length - 1))
      ];
    if (argDesc) {
      const schema = (
        argDesc as unknown as {
          readonly toJsonSchema?: () => { readonly enum?: readonly unknown[] };
        }
      ).toJsonSchema?.();
      if (Array.isArray(schema?.enum)) {
        for (const val of schema.enum) {
          candidates.push(`${String(val)} `);
        }
      }
      if (typeof argDesc.complete === "function") {
        const positionalWords = prior.filter(
          (w, idx) =>
            !w.startsWith("-") && (idx !== 0 || node === model.tree.root),
        );
        const argsMap: Record<string, string> = {};
        for (const [idx, a] of effectiveNode.args.entries()) {
          if (positionalWords[idx]) {
            argsMap[a.name] = positionalWords[idx];
          }
        }
        const res = argDesc.complete({
          word: last,
          words: parts,
          wordIndex: parts.length - 1,
          command: effectiveNode,
          args: argsMap,
          flags: {},
          model,
        } as never);
        if (Array.isArray(res)) {
          for (const item of res) {
            const val = typeof item === "string" ? item : item.value;
            candidates.push(`${val} `);
          }
        }
      }
    }
  }

  const hit = candidates.find(
    (c) => c.startsWith(last) && c.trimEnd() !== last,
  );

  return hit ? hit.slice(last.length) : "";
}

const DEFAULT_SCENARIO: PlaygroundScenario = {
  createCli: () => {
    const dbPlugin = plugin("acme:db")
      .command("db", { group: "db", description: "Database management" })
      .command("db migrate", {
        aliases: "m",
        group: "db",
        description: "Run pending database migrations",
        flags: {
          steps: { type: Types.Integer, short: "s", description: "Max steps" },
          dryRun: { type: Boolean, short: "n", description: "Preview SQL" },
        },
        run({ flags, log }) {
          const dbLog = log.child("db");
          dbLog.debug("Connected to sqlite://local.db");
          dbLog.step("Running migrations", `steps: ${flags.steps ?? "all"}`);
          if (flags.dryRun) {
            dbLog.info("Dry run - no schema changes applied.");
          } else {
            dbLog.success("Database is up to date.");
          }
        },
      })
      .command("db seed", {
        group: "db",
        description: "Seed development data",
        run({ log }) {
          log.child("db").success("Inserted 42 sample records.");
        },
      });

    return clerc({
      name: "acme",
      version: "2.0.0",
      description: "Build and deploy TypeScript services",
    })
      .groups({ commands: { deploy: "Deployment", db: "Database" } })
      .use(dbPlugin)
      .command("deploy <env> [region]", {
        aliases: "d",
        group: "deploy",
        description: "Deploy service to target environment",
        args: {
          env: {
            type: Types.Enum("staging", "prod"),
            description: "Target environment",
          },
          region: { default: "us-east-1", description: "Cloud region" },
        },
        flags: {
          port: {
            type: Types.Range(1, 65_535),
            short: "p",
            default: 3000,
            env: "PORT",
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
            type: String,
            multiple: true,
            short: "t",
            delimiter: ",",
            description: "Release tags",
          },
          json: {
            type: Boolean,
            conflicts: "yaml",
            description: "Output JSON summary",
          },
          yaml: { type: Boolean, description: "Output YAML summary" },
        },
        run({ args, flags, log, terminal }) {
          const summary = {
            env: args.env,
            region: args.region,
            port: flags.port,
            cache: flags.cache,
            dryRun: flags.dryRun,
            tags: flags.tags,
          };
          if (flags.json) {
            terminal.stdout(JSON.stringify(summary, null, 2));

            return;
          }
          if (flags.yaml) {
            for (const [k, v] of Object.entries(summary)) {
              terminal.stdout(
                `${k}: ${Array.isArray(v) ? `[${v.join(", ")}]` : String(v)}`,
              );
            }

            return;
          }
          log.debug("Loaded acme.config.ts");
          log.step(
            `Deploying to ${args.env} (${args.region})`,
            `port=${flags.port}, cache=${String(flags.cache)}`,
          );
          if (flags.tags.length > 0) {
            log.info(`Tags: ${flags.tags.join(", ")}`);
          }
          if (flags.dryRun) {
            log.box.info(
              "Dry run complete",
              "No remote resources were modified.",
            );
          } else {
            log.success(`Deployed ${args.env} successfully.`);
          }
        },
      });
  },
  source: `import { Types, clerc } from "clerc";

const cli = clerc({
  name: "acme",
  version: "2.0.0",
  description: "Build and deploy TypeScript services",
});

cli.command("deploy <env> [region]", {
  aliases: "d",
  args: {
    env: Types.Enum("staging", "prod"),
    region: { default: "us-east-1" },
  },
  flags: {
    port: {
      type: Types.Range(1, 65_535),
      short: "p",
      default: 3000,
    },
    dryRun: { type: Boolean, short: "n" },
    tags: {
      type: String,
      multiple: true,
      short: "t",
      delimiter: ",",
    },
    json: { type: Boolean, conflicts: "yaml" },
    yaml: Boolean,
  },
  run({ args, flags, log }) {
    log.step(
      \`Deploying to \${args.env} (\${args.region})\`,
      \`port=\${flags.port}\`,
    );
    if (flags.dryRun) {
      log.box.info("Dry run", "No remote changes.");
    } else {
      log.success(\`Deployed \${args.env}\`);
    }
  },
});`,
  presets: [
    {
      cmd: "deploy prod eu-west-1 -p 8080 -n -t v2",
      label: "deploy prod -p 8080 -n",
    },
    { cmd: "--help" },
    { cmd: "deploy --help" },
    { cmd: "deply prod" },
    { cmd: "deploy prod -p 70000" },
    { cmd: "db migrate -s 2 -v" },
  ],
};

const COMMANDS_SCENARIO: PlaygroundScenario = {
  createCli: () =>
    clerc({
      name: "vite",
      version: "2.0.0",
      description: "Frontend build tool",
      defaultCommand: "dev",
    })
      .command("dev [root]", {
        description: "Start dev server",
        flags: { port: { type: Number, short: "p", default: 5173 } },
        run({ args, flags, log }) {
          log.step(
            `Dev server running for '${args.root ?? "."}'`,
            `http://localhost:${flags.port}`,
          );
        },
      })
      .command("build [root]", {
        aliases: "b",
        description: "Build for production",
        run({ args, log }) {
          log.success(`Built '${args.root ?? "."}' into dist/`);
        },
      })
      .command("db", { description: "Database utilities" })
      .command("db migrate", {
        aliases: "m",
        description: "Apply pending migrations",
        run({ log }) {
          log.success("Applied 3 migrations");
        },
      })
      .command("exec <cmd> [args...]", {
        description: "Run tool forwarding child flags",
        stopAtFirstPositional: true,
        flags: { quiet: { type: Boolean, short: "q" } },
        run({ args, flags, log }) {
          log.info(`cmd=${args.cmd}, quiet=${String(flags.quiet)}`, {
            forwardedArgs: args.args,
          });
        },
      })
      .command("init-legacy", {
        description: "Scaffold legacy template",
        deprecated: "use 'vite create' instead",
        run({ log }) {
          log.info("Initialized template");
        },
      }),
  source: `const cli = clerc({
  name: "vite",
  version: "2.0.0",
  defaultCommand: "dev",
})
  .command("dev [root]", {
    flags: { port: { type: Number, short: "p", default: 5173 } },
    run: ({ args, flags, log }) =>
      log.step(\`Dev server for '\${args.root ?? "."}'\`, \`port=\${flags.port}\`),
  })
  .command("db", { description: "Database utilities" })
  .command("db migrate", { aliases: "m", run({ log }) { log.success("Migrated"); } })
  .command("exec <cmd> [args...]", {
    stopAtFirstPositional: true,
    flags: { quiet: { type: Boolean, short: "q" } },
    run: ({ args, flags, log }) => log.info(\`cmd=\${args.cmd}\`, args.args),
  })
  .command("init-legacy", {
    deprecated: "use 'vite create' instead",
    run({ log }) { log.info("Initialized"); },
  });`,
  presets: [
    { cmd: "./app -p 4000" },
    { cmd: "--help" },
    { cmd: "db" },
    { cmd: "exec -q git --status -s" },
    { cmd: "init-legacy" },
  ],
};

const ARGUMENTS_SCENARIO: PlaygroundScenario = {
  createCli: () =>
    clerc({ name: "acme", version: "2.0.0" })
      .command("copy <source-path> [dest-path] [extra-files...]", {
        description: "Copy files into destination",
        args: {
          sourcePath: { description: "Source file" },
          destPath: { default: "./dist", description: "Destination dir" },
          extraFiles: { description: "Additional files" },
        },
        run({ args, log }) {
          log.info("Resolved ctx.args", args);
        },
      })
      .command("deploy <token> [region]", {
        description: "Deploy using token arg or DEPLOY_TOKEN",
        args: {
          token: { env: "DEPLOY_TOKEN", description: "API token" },
          region: { default: "us-east-1", description: "Target region" },
        },
        run({ args, log }) {
          log.success(`Authenticated (${args.region})`);
        },
      })
      .command("run <script> -- [pass-through...]", {
        description: "Run package script with passthrough args",
        run({ args, log }) {
          log.step(`Running script '${args.script}'`, {
            passThrough: args.passThrough,
          });
        },
      }),
  source: `cli
  .command("copy <source-path> [dest-path] [extra-files...]", {
    args: { destPath: { default: "./dist" } },
    run({ args, log }) { log.info("Resolved ctx.args", args); },
  })
  .command("deploy <token> [region]", {
    args: {
      token: { env: "DEPLOY_TOKEN" },
      region: { default: "us-east-1" },
    },
    run: ({ args, log }) => log.success(\`Authenticated (\${args.region})\`),
  })
  .command("run <script> -- [pass-through...]", {
    run: ({ args, log }) =>
      log.step(\`Running '\${args.script}'\`, { passThrough: args.passThrough }),
  });`,
  presets: [
    { cmd: "copy src/index.ts out a.ts b.ts" },
    { cmd: "deploy" },
    { cmd: "run test -- --watch --bail" },
    { cmd: "copy --help" },
  ],
};

const FLAGS_SCENARIO: PlaygroundScenario = {
  createCli: () =>
    clerc({ name: "acme", version: "2.0.0" })
      .command("build", {
        description: "Bundle project with POSIX flags",
        flags: {
          tags: { type: String, multiple: true, short: "t", delimiter: "," },
          verbose: { type: Types.Counter, short: "v" },
          release: { type: Boolean, short: "r" },
          dryRun: { type: Boolean, short: "n" },
          cache: { type: Boolean, default: true },
        },
        run({ flags, log }) {
          log.info("Parsed flags", flags);
        },
      })
      .command("dev", {
        description: "Dev server with optional-value --inspect",
        flags: {
          inspect: {
            type: Number,
            short: "I",
            implicitValue: 9229,
            description: "Enable V8 inspector",
          },
        },
        run({ flags, log }) {
          log.info("Inspector state", { inspect: flags.inspect });
        },
      })
      .command("serve", {
        description: "Validate declarative flag constraints",
        flags: {
          json: { type: Boolean, conflicts: ["yaml"] },
          yaml: { type: Boolean },
          tlsKey: { type: String, implies: ["tlsCert"] },
          tlsCert: { type: String },
        },
        run({ flags, log }) {
          log.success("Server configured", flags);
        },
      }),
  source: `cli
  .command("build", {
    flags: {
      tags: { type: String, multiple: true, short: "t", delimiter: "," },
      verbose: { type: Types.Counter, short: "v" },
      release: { type: Boolean, short: "r" },
      dryRun: { type: Boolean, short: "n" },
      cache: { type: Boolean, default: true },
    },
    run({ flags, log }) { log.info("Parsed flags", flags); },
  })
  .command("dev", {
    flags: { inspect: { type: Number, short: "I", implicitValue: 9229 } },
    run({ flags, log }) { log.info("Inspector", { inspect: flags.inspect }); },
  })
  .command("serve", {
    flags: {
      json: { type: Boolean, conflicts: ["yaml"] },
      yaml: Boolean,
      tlsKey: { type: String, implies: ["tlsCert"] },
      tlsCert: String,
    },
    run({ flags, log }) { log.success("Configured", flags); },
  });`,
  presets: [
    { cmd: "build -vrn -t esm,dts --no-cache" },
    { cmd: "build -vvv" },
    { cmd: "dev --inspect" },
    { cmd: "dev --inspect=9230" },
    { cmd: "serve --tls-key key.pem" },
    { cmd: "serve --json --yaml" },
  ],
};

const parseKeyValue: TypeFunction<[string, string]> = (raw) => {
  const eq = raw.indexOf("=");
  if (eq <= 0) {
    throw new Error("expected KEY=VALUE format");
  }

  return [raw.slice(0, eq), raw.slice(eq + 1)];
};
parseKeyValue.display = "KEY=VALUE";

const TYPES_SCENARIO: PlaygroundScenario = {
  createCli: () =>
    clerc({ name: "acme", version: "2.0.0" }).command("release <channel>", {
      description: "Publish a validated release",
      args: {
        channel: {
          type: Types.Enum("alpha", "beta", "rc", "stable"),
          description: "Release channel",
        },
      },
      flags: {
        port: { type: Types.Range(1, 65_535), default: 3000 },
        workers: { type: Types.Integer, default: 4 },
        tag: {
          type: Types.Regex(/^v\d+\.\d+$/, "v<major>.<minor>"),
          description: "Version tag",
        },
        define: {
          type: parseKeyValue,
          multiple: true,
          short: "D",
          description: "Constants",
        },
      },
      run({ args, flags, log }) {
        log.success(`Validated '${args.channel}' release`, {
          port: flags.port,
          workers: flags.workers,
          tag: flags.tag,
          define: Object.fromEntries(flags.define),
        });
      },
    }),
  source: `const parseKeyValue: TypeFunction<[string, string]> = (raw) => {
  const eq = raw.indexOf("=");
  if (eq <= 0) throw new Error("expected KEY=VALUE format");
  return [raw.slice(0, eq), raw.slice(eq + 1)];
};
parseKeyValue.display = "KEY=VALUE";

cli.command("release <channel>", {
  args: { channel: Types.Enum("alpha", "beta", "rc", "stable") },
  flags: {
    port: { type: Types.Range(1, 65_535), default: 3000 },
    workers: { type: Types.Integer, default: 4 },
    tag: { type: Types.Regex(/^v\\d+\\.\\d+$/, "v<major>.<minor>") },
    define: { type: parseKeyValue, multiple: true, short: "D" },
  },
  run({ args, flags, log }) { log.success(args.channel, flags); },
});`,
  presets: [
    { cmd: "release beta --tag v2.1 -D API=prod -D MOCK=0" },
    { cmd: "release --help" },
    { cmd: "release nightly" },
    { cmd: "release rc --workers 1.5" },
    { cmd: "release stable --tag 2.0" },
  ],
};

const MIDDLEWARE_SCENARIO: PlaygroundScenario = {
  createCli: () =>
    clerc({ name: "acme", version: "2.0.0" })
      .flags({ config: { type: String, default: "acme.sqlite" } })
      .middleware(async (ctx, next) => {
        ctx.log.debug("[1] timing start");
        try {
          await next();
        } finally {
          ctx.log.debug("[4] timing teardown (1.2ms)");
        }
      })
      .middleware(async (ctx, next) => {
        const db = {
          url: `sqlite://${ctx.flags.config}`,
          users: ["ray (admin)", "shizuku (maintainer)"],
        };
        ctx.log.debug(`[2] opened ${db.url}`);
        try {
          return await next({ db });
        } finally {
          ctx.log.debug(`[3] closed ${db.url}`);
        }
      })
      .command("users", {
        description: "List workspace users from ctx.state.db",
        run(ctx) {
          ctx.log.step(
            `Loaded ${ctx.state.db.users.length} users`,
            ctx.state.db.users.join(", "),
          );
        },
      }),
  source: `const cli = clerc({ name: "acme", version: "2.0.0" })
  .flags({ config: { type: String, default: "acme.sqlite" } })
  .middleware(async (ctx, next) => {
    const db = { url: \`sqlite://\${ctx.flags.config}\`, users: ["ray", "shizuku"] };
    ctx.log.debug(\`opened \${db.url}\`);
    try {
      return await next({ db });
    } finally {
      ctx.log.debug(\`closed \${db.url}\`);
    }
  })
  .command("users", {
    run(ctx) { ctx.log.step("Users", ctx.state.db.users.join(", ")); },
  });`,
  presets: [
    { cmd: "users -v" },
    { cmd: "users --config prod.db -v" },
    { cmd: "users" },
    { cmd: "users --help" },
  ],
};

const PLUGINS_SCENARIO: PlaygroundScenario = {
  createCli: () => {
    const authPlugin = (defaultRole = "viewer") =>
      plugin("acme:auth")
        .flags({
          token: { type: String, description: "API authentication token" },
        })
        .middleware((ctx, next) => {
          const user = ctx.flags.token
            ? { name: "ray", role: "admin" as const }
            : { name: "guest", role: defaultRole };

          return next({ user });
        });

    const rbacPlugin = plugin("acme:rbac").middleware(
      (ctx, next) => {
        const perms = ctx.command.meta?.permissions as
          readonly string[] | undefined;
        const user = (
          ctx.state as { readonly user?: { readonly role: string } }
        ).user;
        if (perms?.includes("admin") && user?.role !== "admin") {
          throw new ClercError("admin permission required", {
            code: "ERR_VALIDATION",
            detail: `Current role is '${user?.role ?? "guest"}'`,
          }).addHint("pass '--token <secret>' to authenticate as admin");
        }

        return next();
      },
      { enforce: "post" },
    );

    return clerc({ name: "acme", version: "2.0.0" })
      .use(authPlugin())
      .use(rbacPlugin)
      .command("whoami", {
        description: "Show current authenticated identity",
        run(ctx) {
          ctx.log.info(`${ctx.state.user.name} (${ctx.state.user.role})`);
        },
      })
      .command("nuke", {
        description: "Delete staging cluster (admin only)",
        meta: { permissions: ["admin"] },
        run(ctx) {
          ctx.log.box.warn(
            "Cluster deleted",
            `Authorized by ${ctx.state.user.name}.`,
          );
        },
      });
  },
  source: `const authPlugin = (defaultRole = "viewer") =>
  plugin("acme:auth")
    .flags({ token: String })
    .middleware((ctx, next) =>
      next({
        user: ctx.flags.token
          ? { name: "ray", role: "admin" }
          : { name: "guest", role: defaultRole },
      }),
    );

const cli = clerc({ name: "acme", version: "2.0.0" })
  .use(authPlugin())
  .use(rbacPlugin) // enforce: "post", checks command.meta.permissions
  .command("whoami", { run(ctx) { ctx.log.info(ctx.state.user); } })
  .command("nuke", { meta: { permissions: ["admin"] }, run() {} });`,
  presets: [
    { cmd: "whoami" },
    { cmd: "whoami --token sec_live_99" },
    { cmd: "nuke" },
    { cmd: "nuke --token sec_live_99" },
  ],
};

const DIAGNOSTICS_SCENARIO: PlaygroundScenario = {
  createCli: () =>
    clerc({
      name: "acme",
      version: "2.0.0",
      description: "Build and publish packages",
      notes: ["Set NO_COLOR=1 to disable ANSI colors."],
    })
      .groups({
        commands: { core: "Core" },
        flags: { input: "Input Options" },
      })
      .flags({
        json: { type: Boolean, description: "Serialize errors as JSON" },
      })
      .middleware(
        (ctx, next) => {
          if (ctx.flags.json) {
            ctx.log.format = "json";
          }

          return next();
        },
        { enforce: "pre" },
      )
      .command("build <entry>", {
        aliases: "b",
        group: "core",
        description: "Compile source files",
        args: { entry: { description: "Entry file path" } },
        flags: {
          output: { type: String, short: "o", description: "Output directory" },
          cache: {
            type: Boolean,
            default: true,
            group: "input",
            description: "Use build cache",
          },
        },
        run({ args, flags, log }) {
          log.success(`Compiled ${args.entry} -> ${flags.output ?? "dist"}`);
        },
      })
      .command("publish", {
        group: "core",
        description: "Publish package to registry",
        run({ flags, log }) {
          if (flags.json) {
            log.format = "json";
          }

          throw new ClercError("not logged in to registry", {
            code: "ERR_VALIDATION",
            detail: "No token found in ~/.acmerc or ACME_TOKEN",
            usage: "acme login --registry https://registry.acme.dev",
          }).addHint("run 'acme login' first or set ACME_TOKEN");
        },
      }),
  source: `const cli = clerc({ name: "acme", version: "2.0.0" })
  .groups({ commands: { core: "Core" }, flags: { input: "Input Options" } })
  .command("build <entry>", {
    aliases: "b",
    group: "core",
    flags: {
      output: { type: String, short: "o" },
      cache: { type: Boolean, default: true, group: "input" },
    },
    run({ args, log }) { log.success(args.entry); },
  })
  .command("publish", {
    run() {
      throw new ClercError("not logged in to registry", {
        code: "ERR_VALIDATION",
        detail: "No token found in ~/.acmerc or ACME_TOKEN",
        usage: "acme login --registry https://registry.acme.dev",
      }).addHint("run 'acme login' first or set ACME_TOKEN");
    },
  });`,
  presets: [
    { cmd: "build --help" },
    { cmd: "buid src/index.ts" },
    { cmd: "build src/index.ts --outpt dist" },
    { cmd: "publish" },
    { cmd: "publish --json" },
  ],
};

const LOGGER_SCENARIO: PlaygroundScenario = {
  createCli: () =>
    clerc({ name: "acme", version: "2.0.0" }).command("demo", {
      description: "Preview @clerc/logger output modes",
      flags: {
        box: { type: Boolean, description: "Render callout box" },
        fail: { type: Boolean, description: "Log Error with cause chain" },
        json: { type: Boolean, description: "Switch log.format to json" },
      },
      run({ flags, log }) {
        if (flags.json) {
          log.format = "json";
        }
        const step = log.step("Building targets");
        step.line("0001_bundle.mjs (12ms)");
        step.line("0002_types.d.mts (8ms)");

        log.info("Resolved config", { port: 3000, cache: true });
        log.child("db").child("migrate").debug("Query finished in 1.2ms");

        if (flags.box) {
          log.box.warn(
            "Dry run mode",
            "No remote changes were written.",
            "Pass --confirm to execute.",
          );
        }
        if (flags.fail) {
          log.error(
            new TypeError("Invalid port", {
              cause: new Error("PORT env malformed"),
            }),
          );
        } else {
          log.success("All targets built.");
        }
      },
    }),
  source: `cli.command("demo", {
  flags: { box: Boolean, fail: Boolean, json: Boolean },
  run({ flags, log }) {
    if (flags.json) log.format = "json";
    log.step("Building targets")
      .line("0001_bundle.mjs (12ms)")
      .line("0002_types.d.mts (8ms)");
    log.info("Resolved config", { port: 3000, cache: true });
    log.child("db").child("migrate").debug("Query finished in 1.2ms");
    if (flags.box) log.box.warn("Dry run mode", "No remote changes.");
    if (flags.fail) log.error(new TypeError("Invalid port", { cause: new Error("PORT malformed") }));
  },
});`,
  presets: [
    { cmd: "demo -v" },
    { cmd: "demo --box" },
    { cmd: "demo --fail" },
    { cmd: "demo --json" },
    { cmd: "demo -q" },
  ],
};

const COMPLETIONS_SCENARIO: PlaygroundScenario = {
  createCli: () =>
    clerc({ name: "acme", version: "2.0.0" })
      .command("deploy <env> [service]", {
        aliases: ["d"],
        description: "Deploy application with context-aware completions",
        args: {
          env: {
            type: Types.Enum("staging", "prod"),
            description: "Target environment",
          },
          service: {
            description: "Service worker name",
            complete({ args }) {
              const target = (args.env as string | undefined) ?? "staging";

              return [
                { value: `${target}-api`, description: "REST & GraphQL API" },
                { value: `${target}-web`, description: "Frontend worker" },
              ];
            },
          },
        },
        flags: {
          region: {
            type: String,
            short: "r",
            default: "us-east-1",
            complete: () => [
              { value: "us-east-1", description: "US East (N. Virginia)" },
              { value: "eu-west-1", description: "Europe (Ireland)" },
            ],
          },
        },
        run({ args, flags, log }) {
          log.step(
            `Deploying ${args.service ?? `${args.env}-api`}`,
            `env=${args.env}, region=${flags.region}`,
          );
          log.success(
            "Rollout complete (press Tab while typing to test completions)",
          );
        },
      })
      .command("completions <shell>", {
        description: "Print shell completion setup script",
        args: { shell: Types.Enum("zsh", "bash", "fish", "powershell") },
        run({ args, terminal }) {
          terminal.stdout(`#compdef acme (${args.shell})`);
          terminal.stdout(
            "_acme() { _describe 'acme' \"$(acme __complete -- zsh $words)\" }",
          );
          terminal.stdout("compdef _acme acme");
        },
      }),
  source: `cli.command("deploy <env> [service]", {
  args: {
    env: Types.Enum("staging", "prod"), // auto-completed
    service: {
      complete: ({ args }) => [
        { value: \`\${args.env ?? "staging"}-api\`, description: "API worker" },
        { value: \`\${args.env ?? "staging"}-web\`, description: "Frontend" },
      ],
    },
  },
  flags: {
    region: {
      type: String,
      short: "r",
      complete: () => ["us-east-1", "eu-west-1"],
    },
  },
  run({ args, flags, log }) { log.success(args.service, flags); },
});`,
  presets: [
    { cmd: "deploy staging staging-api -r eu-west-1" },
    { cmd: "deploy prod prod-web" },
    { cmd: "completions zsh" },
    { cmd: "help deploy" },
  ],
};

const MCP_SCENARIO: PlaygroundScenario = {
  createCli: () => {
    const app = clerc({
      name: "acme",
      version: "2.0.0",
      description: "Manage Acme deployments and cluster health",
    })
      .command("deploy <env>", {
        description: "Deploy service to target environment",
        args: { env: Types.Enum("staging", "prod") },
        flags: {
          dryRun: { type: Boolean, description: "Preview without deploying" },
        },
        meta: { mcp: { destructive: true } },
        run({ args, flags, log }) {
          log.info(`Deployed ${args.env} (dryRun=${String(flags.dryRun)})`);
        },
      })
      .command("status", {
        description: "Check cluster health",
        meta: { mcp: { readOnly: true, idempotent: true } },
        run({ terminal }) {
          terminal.stdout("cluster=healthy latency=14ms");
        },
      });

    const handler = createMcpHandler({
      model: app.buildModel(),
      run: (argv, opts) => app.run(argv, opts),
    });

    return app.command("rpc <method> [target]", {
      description: "Send a live JSON-RPC 2.0 request to @clerc/plugin-mcp",
      args: {
        method: Types.Enum(
          "tools/list",
          "tools/call",
          "resources/list",
          "resources/read",
        ),
        target: { description: "Tool name or resource URI" },
      },
      flags: {
        env: { type: Types.Enum("staging", "prod"), default: "prod" },
        dryRun: { type: Boolean, default: true },
      },
      async run({ args, flags, terminal }) {
        const params =
          args.method === "tools/call"
            ? {
                name: args.target ?? "deploy",
                arguments:
                  (args.target ?? "deploy") === "deploy"
                    ? { env: flags.env, dryRun: flags.dryRun }
                    : {},
              }
            : args.method === "resources/read"
              ? { uri: args.target ?? "clerc://help/deploy" }
              : {};
        const res = await handler({
          jsonrpc: "2.0",
          id: 1,
          method: args.method,
          params,
        });
        terminal.stdout(JSON.stringify(res?.result ?? res, null, 2));
      },
    });
  },
  source: `import { mcpPlugin } from "@clerc/plugin-mcp";
import { Types, clerc } from "clerc";

const cli = clerc({ name: "acme", version: "2.0.0" })
  .use(mcpPlugin())
  .command("deploy <env>", {
    args: { env: Types.Enum("staging", "prod") },
    flags: { dryRun: Boolean },
    meta: { mcp: { destructive: true } },
    run({ args, flags, log }) { log.info(\`Deployed \${args.env}\`); },
  })
  .command("status", {
    meta: { mcp: { readOnly: true, idempotent: true } },
    run({ terminal }) { terminal.stdout("cluster=healthy"); },
  });`,
  presets: [
    { cmd: "rpc tools/list" },
    { cmd: "rpc tools/call deploy --env prod --dry-run" },
    { cmd: "rpc tools/call status" },
    { cmd: "rpc resources/list" },
    { cmd: "rpc resources/read clerc://help/deploy" },
  ],
};

const TESTING_SCENARIO: PlaygroundScenario = {
  env: { ACME_TOKEN: "secret_123" },
  createCli: () => {
    const cli = clerc({
      name: "acme",
      version: "2.0.0",
      description: "In-memory testable CLI (env: ACME_TOKEN=secret_123)",
    })
      .command("deploy <env>", {
        description: "Deploy using ACME_TOKEN from MemoryTerminal env",
        args: { env: Types.Enum("staging", "prod") },
        flags: {
          token: { type: String, required: true, env: "ACME_TOKEN" },
        },
        run({ args, flags, log }) {
          log.success(
            `Deployed to ${args.env}`,
            `token=${flags.token.slice(0, 6)}***`,
          );
        },
      })
      .command("inspect-model", {
        description: "Inspect immutable cli.buildModel() metadata",
        run({ model, log }) {
          const commands = model.tree
            .listVisibleChildren(model.tree.root)
            .map((c) => c.name);
          log.info("Compiled CliModel", {
            name: model.meta.name,
            version: model.meta.version,
            commands,
          });
        },
      });

    return cli;
  },
  source: `const terminal = createMemoryTerminal({
  env: { ACME_TOKEN: "secret_123" },
});

const ok = await cli.run(["deploy", "staging"], { terminal });
// ok.exitCode === 0, terminal.stdoutText() captured in memory

const bad = await cli.run(["deploy", "qa"], { terminal });
// bad.exitCode === 2, no process.exit() called`,
  presets: [
    { cmd: "deploy staging" },
    { cmd: "deploy qa" },
    { cmd: "inspect-model" },
    { cmd: "deploy --help" },
  ],
};

export const SCENARIOS: Readonly<Record<ScenarioId, PlaygroundScenario>> = {
  default: DEFAULT_SCENARIO,
  commands: COMMANDS_SCENARIO,
  arguments: ARGUMENTS_SCENARIO,
  flags: FLAGS_SCENARIO,
  types: TYPES_SCENARIO,
  middleware: MIDDLEWARE_SCENARIO,
  plugins: PLUGINS_SCENARIO,
  diagnostics: DIAGNOSTICS_SCENARIO,
  logger: LOGGER_SCENARIO,
  completions: COMPLETIONS_SCENARIO,
  mcp: MCP_SCENARIO,
  testing: TESTING_SCENARIO,
};
