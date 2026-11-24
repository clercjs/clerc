import type { PropType } from "vue";
import { computed, defineComponent, h, ref } from "vue";

import { findClosest } from "../../../packages/clerc/src/suggest.ts";
import {
  formatFlagName,
  kebabCase,
} from "../../../packages/clerc/src/utils.ts";

interface Span {
  readonly text: string;
  readonly cls?: string;
}

type Line = readonly Span[];

interface FlagSpec {
  readonly name: string;
  readonly short?: string;
  readonly kind: "boolean" | "counter" | "single" | "array";
  readonly negatable?: boolean;
}

const s = (text: string, cls?: string): Span => ({ text, cls });
const plain = (text = ""): Line => [s(text)];
const RULE = "─".repeat(68);

const ALL_COMMANDS = ["deploy", "db migrate", "db seed", "version", "help"];
const DB_SUBCOMMANDS = ["db migrate", "db seed"];

const GLOBAL_SPECS: readonly FlagSpec[] = [
  { name: "config", short: "c", kind: "single" },
  { name: "quiet", short: "q", kind: "boolean", negatable: true },
  { name: "verbose", short: "v", kind: "counter" },
  { name: "help", short: "h", kind: "boolean" },
  { name: "version", short: "V", kind: "boolean" },
];

const DEPLOY_SPECS: readonly FlagSpec[] = [
  ...GLOBAL_SPECS.filter((f) => f.name !== "version"),
  { name: "port", short: "p", kind: "single" },
  { name: "dryRun", short: "n", kind: "boolean", negatable: true },
  { name: "cache", kind: "boolean", negatable: true },
  { name: "tags", short: "t", kind: "array" },
  { name: "json", kind: "boolean", negatable: true },
  { name: "yaml", kind: "boolean", negatable: true },
];

const MIGRATE_SPECS: readonly FlagSpec[] = [
  ...GLOBAL_SPECS.filter((f) => f.name !== "version"),
  { name: "steps", short: "s", kind: "single" },
  { name: "dryRun", short: "n", kind: "boolean", negatable: true },
];

function tokenize(raw: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  for (const ch of raw) {
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

const renderRootHelp = (): Line[] => [
  [s("acme", "t-brand"), s(" "), s("v2.0.0", "t-muted")],
  plain("Build and deploy TypeScript services"),
  [s(RULE, "t-muted")],
  [
    s("USAGE", "t-heading"),
    s("   "),
    s("acme", "t-bold"),
    s(" "),
    s("<command>", "t-muted"),
    s(" "),
    s("[options]", "t-muted"),
  ],
  plain(),
  [s("DEPLOYMENT", "t-heading")],
  [
    s("  "),
    s("deploy", "t-bold"),
    s(" (d)", "t-muted"),
    s("       Deploy service to target environment"),
  ],
  plain(),
  [s("DATABASE", "t-heading")],
  [
    s("  "),
    s("db migrate", "t-bold"),
    s(" (m)", "t-muted"),
    s("   Run pending database migrations"),
  ],
  [s("  "), s("db seed", "t-bold"), s("          Seed development data")],
  plain(),
  [s("COMMANDS", "t-heading")],
  [s("  "), s("version", "t-bold"), s("          Show version")],
  [s("  "), s("help", "t-bold"), s("             Show help for a command")],
  plain(),
  [s("OPTIONS", "t-heading")],
  [
    s("  "),
    s("-c", "t-cyan"),
    s(", ", "t-muted"),
    s("--config", "t-cyan"),
    s(" <string>", "t-muted"),
    s("   Path to config file  "),
    s("[default: acme.config.ts]", "t-muted"),
  ],
  [
    s("  "),
    s("-q", "t-cyan"),
    s(", ", "t-muted"),
    s("--quiet", "t-cyan"),
    s("             Suppress non-error output"),
  ],
  [
    s("  "),
    s("-v", "t-cyan"),
    s(", ", "t-muted"),
    s("--verbose", "t-cyan"),
    s("           Enable verbose debug logging"),
  ],
  [
    s("  "),
    s("-V", "t-cyan"),
    s(", ", "t-muted"),
    s("--version", "t-cyan"),
    s("           Show version"),
  ],
  [
    s("  "),
    s("-h", "t-cyan"),
    s(", ", "t-muted"),
    s("--help", "t-cyan"),
    s("              Show help"),
  ],
];

const renderDeployHelp = (): Line[] => [
  [
    s("acme", "t-muted"),
    s(" "),
    s("deploy", "t-brand"),
    s(" "),
    s("v2.0.0  alias: d", "t-muted"),
  ],
  plain("Deploy service to target environment"),
  [s(RULE, "t-muted")],
  [
    s("USAGE", "t-heading"),
    s("   "),
    s("acme deploy", "t-bold"),
    s(" "),
    s("[options]", "t-muted"),
    s(" "),
    s("<env>", "t-muted"),
    s(" "),
    s("[region]", "t-muted"),
  ],
  plain(),
  [s("ARGUMENTS", "t-heading")],
  [
    s("  "),
    s("<env>", "t-bold"),
    s("                    Target environment  "),
    s("[staging|prod]", "t-muted"),
  ],
  [
    s("  "),
    s("[region]", "t-bold"),
    s("                 Cloud region  "),
    s("[default: us-east-1]", "t-muted"),
  ],
  plain(),
  [s("OPTIONS", "t-heading")],
  [
    s("  "),
    s("-p", "t-cyan"),
    s(", ", "t-muted"),
    s("--port", "t-cyan"),
    s(" <1..65535>", "t-muted"),
    s("    Server port  "),
    s("[default: 3000] [env: PORT]", "t-muted"),
  ],
  [
    s("  "),
    s("-n", "t-cyan"),
    s(", ", "t-muted"),
    s("--dry-run", "t-cyan"),
    s("            Preview without deploying"),
  ],
  [
    s("      "),
    s("--cache", "t-cyan"),
    s(", ", "t-muted"),
    s("--no-cache", "t-cyan"),
    s("  Use build cache  "),
    s("[default: true]", "t-muted"),
  ],
  [
    s("  "),
    s("-t", "t-cyan"),
    s(", ", "t-muted"),
    s("--tags", "t-cyan"),
    s(" <string...>", "t-muted"),
    s("   Release tags"),
  ],
  [
    s("      "),
    s("--json", "t-cyan"),
    s("               Format summary as JSON"),
  ],
  [
    s("      "),
    s("--yaml", "t-cyan"),
    s("               Format summary as YAML"),
  ],
  plain(),
  [s("GLOBAL OPTIONS", "t-heading")],
  [
    s("  "),
    s("-c", "t-cyan"),
    s(", ", "t-muted"),
    s("--config", "t-cyan"),
    s(" <string>", "t-muted"),
    s("    Path to config file  "),
    s("[default: acme.config.ts]", "t-muted"),
  ],
  [
    s("  "),
    s("-q", "t-cyan"),
    s(", ", "t-muted"),
    s("--quiet", "t-cyan"),
    s("              Suppress non-error output"),
  ],
  [
    s("  "),
    s("-v", "t-cyan"),
    s(", ", "t-muted"),
    s("--verbose", "t-cyan"),
    s("            Enable verbose debug logging"),
  ],
  [
    s("  "),
    s("-h", "t-cyan"),
    s(", ", "t-muted"),
    s("--help", "t-cyan"),
    s("               Show help"),
  ],
];

const renderMigrateHelp = (): Line[] => [
  [
    s("acme", "t-muted"),
    s(" "),
    s("db migrate", "t-brand"),
    s(" "),
    s("v2.0.0  alias: m", "t-muted"),
  ],
  plain("Run pending database migrations"),
  [s(RULE, "t-muted")],
  [
    s("USAGE", "t-heading"),
    s("   "),
    s("acme db migrate", "t-bold"),
    s(" "),
    s("[options]", "t-muted"),
  ],
  plain(),
  [s("OPTIONS", "t-heading")],
  [
    s("  "),
    s("-s", "t-cyan"),
    s(", ", "t-muted"),
    s("--steps", "t-cyan"),
    s(" <integer>", "t-muted"),
    s("   Number of migrations to apply"),
  ],
  [
    s("  "),
    s("-n", "t-cyan"),
    s(", ", "t-muted"),
    s("--dry-run", "t-cyan"),
    s("           Preview SQL only"),
  ],
  plain(),
  [s("GLOBAL OPTIONS", "t-heading")],
  [
    s("  "),
    s("-q", "t-cyan"),
    s(", ", "t-muted"),
    s("--quiet", "t-cyan"),
    s("             Suppress non-error output"),
  ],
  [
    s("  "),
    s("-v", "t-cyan"),
    s(", ", "t-muted"),
    s("--verbose", "t-cyan"),
    s("           Enable verbose debug logging"),
  ],
  [
    s("  "),
    s("-h", "t-cyan"),
    s(", ", "t-muted"),
    s("--help", "t-cyan"),
    s("              Show help"),
  ],
];

function diagnostic(
  message: string,
  opts: { detail?: string; hint?: string; cmdPath?: string } = {},
): { readonly exitCode: number; readonly lines: readonly Line[] } {
  const lines: Line[] = [[s("error", "t-red"), s("  "), s(message)]];
  if (opts.detail) {
    lines.push([s("       "), s(opts.detail, "t-muted")]);
  }
  if (opts.hint) {
    lines.push(plain(), [s("tip  ", "t-tip"), s("  "), s(opts.hint)]);
  }
  const suffix = opts.cmdPath ? ` ${opts.cmdPath}` : "";
  lines.push(plain(), [
    s("       "),
    s(`For more information, try 'acme${suffix} --help'.`, "t-muted"),
  ]);

  return { exitCode: 2, lines };
}

function parseTokens(argv: readonly string[], specs: readonly FlagSpec[]) {
  const byLong = new Map<string, { spec: FlagSpec; negated: boolean }>();
  const byShort = new Map<string, FlagSpec>();
  const knownNames: string[] = [];

  for (const spec of specs) {
    const kebab = kebabCase(spec.name);
    byLong.set(spec.name, { spec, negated: false });
    byLong.set(kebab, { spec, negated: false });
    knownNames.push(kebab);
    if (spec.negatable) {
      byLong.set(`no-${kebab}`, { spec, negated: true });
    }
    if (spec.short) {
      byShort.set(spec.short, spec);
    }
  }

  const flags: Record<string, any> = {};
  const provided = new Set<string>();
  const positionals: string[] = [];
  const unknown: string[] = [];
  let missingValue: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === "--") {
      positionals.push(...argv.slice(i + 1));

      break;
    }
    if (tok.startsWith("--")) {
      const eq = tok.indexOf("=");
      const rawName = eq === -1 ? tok.slice(2) : tok.slice(2, eq);
      const hit = byLong.get(rawName);
      if (!hit) {
        unknown.push(rawName);

        continue;
      }
      const { spec, negated } = hit;
      provided.add(spec.name);
      if (spec.kind === "boolean") {
        flags[spec.name] = negated
          ? false
          : eq === -1
            ? true
            : tok.slice(eq + 1) !== "false";
      } else if (spec.kind === "counter") {
        flags[spec.name] = ((flags[spec.name] as number | undefined) ?? 0) + 1;
      } else {
        const val = eq === -1 ? argv[++i] : tok.slice(eq + 1);
        if (val === undefined || (eq === -1 && val.startsWith("-"))) {
          missingValue = spec.name;

          break;
        }
        if (spec.kind === "array") {
          (
            (flags[spec.name] as string[] | undefined) ??
            (flags[spec.name] = [])
          ).push(val);
        } else {
          flags[spec.name] = val;
        }
      }

      continue;
    }
    if (tok.startsWith("-") && tok.length > 1) {
      for (let j = 1; j < tok.length; j++) {
        const ch = tok[j];
        const spec = byShort.get(ch);
        if (!spec) {
          unknown.push(ch);

          continue;
        }
        provided.add(spec.name);
        if (spec.kind === "boolean") {
          flags[spec.name] = true;
        } else if (spec.kind === "counter") {
          flags[spec.name] =
            ((flags[spec.name] as number | undefined) ?? 0) + 1;
        } else {
          const attached = tok.slice(j + 1).replace(/^=/, "");
          const val = attached.length > 0 ? attached : argv[++i];
          if (!val || (attached.length === 0 && val.startsWith("-"))) {
            missingValue = spec.name;
          } else if (spec.kind === "array") {
            (
              (flags[spec.name] as string[] | undefined) ??
              (flags[spec.name] = [])
            ).push(val);
          } else {
            flags[spec.name] = val;
          }

          break;
        }
      }

      continue;
    }
    positionals.push(tok);
  }

  return { flags, provided, positionals, unknown, missingValue, knownNames };
}

function evaluateCli(rawInput: string): {
  readonly exitCode: number;
  readonly lines: readonly Line[];
} {
  const cleaned = rawInput
    .trim()
    .replace(/^\$\s*/, "")
    .replace(/^acme\b\s*/, "");
  const tokens = tokenize(cleaned);

  if (tokens.length === 0) {
    return { exitCode: 0, lines: renderRootHelp() };
  }

  const head = tokens[0];
  if (
    head === "version" ||
    (head.startsWith("-") &&
      (tokens.includes("--version") || tokens.includes("-V")))
  ) {
    return { exitCode: 0, lines: [plain("acme v2.0.0")] };
  }

  if (head === "help") {
    const target = tokens.slice(1).join(" ");
    if (!target) {
      return { exitCode: 0, lines: renderRootHelp() };
    }
    if (target === "deploy" || target === "d") {
      return { exitCode: 0, lines: renderDeployHelp() };
    }
    if (target === "db migrate" || target === "db m") {
      return { exitCode: 0, lines: renderMigrateHelp() };
    }
    const suggestion = findClosest(target, ALL_COMMANDS, 4);

    return diagnostic(`unknown command '${target}'`, {
      hint: suggestion
        ? `a similar command exists: '${suggestion}'`
        : undefined,
    });
  }

  if (head === "deploy" || head === "d") {
    const parsed = parseTokens(tokens.slice(1), DEPLOY_SPECS);
    if (parsed.flags.help) {
      return { exitCode: 0, lines: renderDeployHelp() };
    }
    if (parsed.missingValue) {
      return diagnostic(
        `option '${formatFlagName(parsed.missingValue)}' requires a value`,
        { cmdPath: "deploy" },
      );
    }
    if (parsed.unknown.length > 0) {
      const unk = parsed.unknown[0];
      const suggestion =
        unk.length > 1
          ? findClosest(kebabCase(unk), parsed.knownNames, 3)
          : undefined;

      return diagnostic(`unexpected option: '${formatFlagName(unk)}'`, {
        hint: suggestion
          ? `a similar option exists: '${formatFlagName(suggestion)}'`
          : undefined,
        cmdPath: "deploy",
      });
    }
    if (parsed.provided.has("json") && parsed.provided.has("yaml")) {
      return diagnostic(
        "option '--json' cannot be used together with '--yaml'",
        { cmdPath: "deploy" },
      );
    }
    const env = parsed.positionals[0];
    if (!env) {
      return diagnostic("missing required argument '<env>'", {
        cmdPath: "deploy",
      });
    }
    if (env !== "staging" && env !== "prod") {
      return diagnostic(`invalid value '${env}' for '<env>'`, {
        detail: "expected one of: 'staging', 'prod'",
        cmdPath: "deploy",
      });
    }
    if (parsed.positionals.length > 2) {
      return diagnostic(`unexpected argument: '${parsed.positionals[2]}'`, {
        cmdPath: "deploy",
      });
    }
    const region = parsed.positionals[1] ?? "us-east-1";
    const port =
      parsed.flags.port === undefined ? 3000 : Number(parsed.flags.port);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      return diagnostic(
        `invalid value '${String(parsed.flags.port)}' for '--port'`,
        {
          detail: "expected a number between 1 and 65535",
          cmdPath: "deploy",
        },
      );
    }
    const cache = (parsed.flags.cache as boolean | undefined) ?? true;
    const dryRun = Boolean(parsed.flags.dryRun);
    const tags = (parsed.flags.tags as string[] | undefined) ?? [];
    const configPath =
      (parsed.flags.config as string | undefined) ?? "acme.config.ts";
    const summary = {
      env,
      region,
      port,
      cache,
      dryRun,
      tags,
      config: configPath,
    };

    if (parsed.flags.json) {
      return {
        exitCode: 0,
        lines: JSON.stringify(summary, null, 2)
          .split("\n")
          .map((l) => plain(l)),
      };
    }
    if (parsed.flags.yaml) {
      return {
        exitCode: 0,
        lines: Object.entries(summary).map(([k, v]) =>
          plain(`${k}: ${Array.isArray(v) ? `[${v.join(", ")}]` : String(v)}`),
        ),
      };
    }
    if (parsed.flags.quiet) {
      return {
        exitCode: 0,
        lines: [[s("(quiet mode - non-error output suppressed)", "t-faint")]],
      };
    }

    const out: Line[] = [];
    const verbose = (parsed.flags.verbose as number | undefined) ?? 0;
    if (verbose > 0) {
      out.push([
        s("debug", "t-faint"),
        s("  "),
        s(`Loaded config from ${configPath}`, "t-faint"),
      ]);
    }
    out.push(
      [
        s("step ", "t-brand"),
        s("  "),
        s(`Deploying to ${env} (${region})`, "t-bold"),
      ],
      [
        s("       "),
        s("│ ", "t-faint"),
        s(`port=${port}, cache=${String(cache)}`, "t-muted"),
      ],
    );
    if (tags.length > 0) {
      out.push([s("info ", "t-cyan"), s("  "), s(`Tags: ${tags.join(", ")}`)]);
    }
    if (dryRun) {
      out.push(
        [
          s("info ", "t-cyan"),
          s("  "),
          s("╭─ ", "t-faint"),
          s("Dry run complete", "t-bold"),
          s(" ──────────────────────╮", "t-faint"),
        ],
        [
          s("       "),
          s("│  ", "t-faint"),
          s("No remote resources were modified.", "t-muted"),
          s("     │", "t-faint"),
        ],
        [
          s("       "),
          s("╰─────────────────────────────────────────╯", "t-faint"),
        ],
      );
    } else {
      out.push([
        s("done ", "t-green"),
        s("  "),
        s(`Deployed ${env} successfully!`),
      ]);
    }
    if (verbose > 0) {
      out.push([
        s("debug", "t-faint"),
        s("  "),
        s("Command 'deploy' finished in 1.4ms", "t-faint"),
      ]);
    }

    return { exitCode: 0, lines: out };
  }

  if (head === "db") {
    const sub = tokens[1];
    if (!sub || sub === "--help" || sub === "-h") {
      return {
        exitCode: 0,
        lines: [
          [
            s("acme", "t-muted"),
            s(" "),
            s("db", "t-brand"),
            s(" "),
            s("v2.0.0", "t-muted"),
          ],
          plain("Database management commands"),
          [s(RULE, "t-muted")],
          [
            s("USAGE", "t-heading"),
            s("   "),
            s("acme db", "t-bold"),
            s(" "),
            s("<command>", "t-muted"),
            s(" "),
            s("[options]", "t-muted"),
          ],
          plain(),
          [s("SUBCOMMANDS", "t-heading")],
          [
            s("  "),
            s("migrate", "t-bold"),
            s(" (m)", "t-muted"),
            s("   Run pending database migrations"),
          ],
          [s("  "), s("seed", "t-bold"), s("          Seed development data")],
        ],
      };
    }
    if (sub === "migrate" || sub === "m") {
      const parsed = parseTokens(tokens.slice(2), MIGRATE_SPECS);
      if (parsed.flags.help) {
        return { exitCode: 0, lines: renderMigrateHelp() };
      }
      if (parsed.unknown.length > 0) {
        const unk = parsed.unknown[0];
        const suggestion =
          unk.length > 1
            ? findClosest(kebabCase(unk), parsed.knownNames, 3)
            : undefined;

        return diagnostic(`unexpected option: '${formatFlagName(unk)}'`, {
          hint: suggestion
            ? `a similar option exists: '${formatFlagName(suggestion)}'`
            : undefined,
          cmdPath: "db migrate",
        });
      }
      const stepsRaw = parsed.flags.steps as string | undefined;
      if (
        stepsRaw !== undefined &&
        (!Number.isInteger(Number(stepsRaw)) || stepsRaw.trim() === "")
      ) {
        return diagnostic(`invalid value '${stepsRaw}' for '--steps'`, {
          detail: "expected an integer",
          cmdPath: "db migrate",
        });
      }
      if (parsed.flags.quiet) {
        return {
          exitCode: 0,
          lines: [[s("(quiet mode - non-error output suppressed)", "t-faint")]],
        };
      }
      const out: Line[] = [];
      const verbose = (parsed.flags.verbose as number | undefined) ?? 0;
      if (verbose > 0) {
        out.push([
          s("debug", "t-faint"),
          s("  "),
          s("db › Connected to sqlite://local.db", "t-faint"),
        ]);
      }
      out.push(
        [
          s("step ", "t-brand"),
          s("  "),
          s("db", "t-muted"),
          s(" › ", "t-faint"),
          s("Running database migrations", "t-bold"),
        ],
        [
          s("       "),
          s("│ ", "t-faint"),
          s(`steps: ${stepsRaw ?? "all"}`, "t-muted"),
        ],
      );
      if (parsed.flags.dryRun) {
        out.push([
          s("info ", "t-cyan"),
          s("  "),
          s("db", "t-muted"),
          s(" › ", "t-faint"),
          s("Dry run enabled - no schema changes applied."),
        ]);
      } else {
        out.push([
          s("done ", "t-green"),
          s("  "),
          s("db", "t-muted"),
          s(" › ", "t-faint"),
          s("Database is up to date!"),
        ]);
      }
      if (verbose > 0) {
        out.push([
          s("debug", "t-faint"),
          s("  "),
          s("Command 'db migrate' finished in 2.1ms", "t-faint"),
        ]);
      }

      return { exitCode: 0, lines: out };
    }
    if (sub === "seed") {
      return {
        exitCode: 0,
        lines: [
          [
            s("step ", "t-brand"),
            s("  "),
            s("db", "t-muted"),
            s(" › ", "t-faint"),
            s("Seeding database", "t-bold"),
          ],
          [
            s("done ", "t-green"),
            s("  "),
            s("db", "t-muted"),
            s(" › ", "t-faint"),
            s("Inserted 42 sample records."),
          ],
        ],
      };
    }

    const fullAttempt = `db ${sub}`;
    const suggestion = findClosest(fullAttempt, DB_SUBCOMMANDS, 4);

    return diagnostic(`unknown command '${fullAttempt}'`, {
      hint: suggestion
        ? `a similar command exists: '${suggestion}'`
        : "available subcommands: migrate, seed",
      cmdPath: "db",
    });
  }

  if (head.startsWith("-")) {
    const parsed = parseTokens(tokens, GLOBAL_SPECS);
    if (parsed.flags.help) {
      return { exitCode: 0, lines: renderRootHelp() };
    }
    if (parsed.unknown.length > 0) {
      const unk = parsed.unknown[0];
      const suggestion =
        unk.length > 1
          ? findClosest(kebabCase(unk), parsed.knownNames, 3)
          : undefined;

      return diagnostic(`unexpected option: '${formatFlagName(unk)}'`, {
        hint: suggestion
          ? `a similar option exists: '${formatFlagName(suggestion)}'`
          : undefined,
      });
    }

    return { exitCode: 0, lines: renderRootHelp() };
  }

  const suggestion = findClosest(head, ALL_COMMANDS, 4);

  return diagnostic(`unknown command '${head}'`, {
    hint: suggestion ? `a similar command exists: '${suggestion}'` : undefined,
  });
}

const SOURCE_SNIPPET = `import { Types, clerc, plugin, verbosityPlugin } from "clerc";

const dbPlugin = plugin("acme:db")
  .command("db", { group: "db", description: "Database management commands" })
  .command("db migrate", {
    aliases: "m",
    group: "db",
    flags: {
      steps: { type: Types.Integer, short: "s" },
      dryRun: { type: Boolean, short: "n" },
    },
    run(ctx) {
      const log = ctx.log.child("db");
      log.step("Running database migrations", \`steps: \${ctx.flags.steps ?? "all"}\`);
      log.success("Database is up to date!");
    },
  });

const cli = clerc({
  name: "acme",
  version: "2.0.0",
  description: "Build and deploy TypeScript services",
})
  .groups({ commands: { deploy: "Deployment", db: "Database" } })
  .use(verbosityPlugin())
  .use(dbPlugin);

cli.command("deploy <env> [region]", {
  aliases: "d",
  group: "deploy",
  args: { env: Types.Enum("staging", "prod") },
  flags: {
    port: { type: Types.Range(1, 65_535), short: "p", default: 3000, env: "PORT" },
    dryRun: { type: Boolean, short: "n" },
    cache: { type: Boolean, default: true },
    tags: { type: [String], short: "t" },
    json: { type: Boolean, conflicts: "yaml" },
    yaml: { type: Boolean },
  },
  run(ctx) { /* fully typed ctx.args & ctx.flags */ },
});`;

export const CliPlayground = defineComponent({
  name: "CliPlayground",
  props: {
    lang: {
      type: String as PropType<"en" | "zh">,
      default: "en",
    },
  },
  setup(props) {
    const commandInput = ref("deploy prod eu-west-1 -p 8080 -n -t v2");
    const activeTab = ref<"terminal" | "code">("terminal");

    const presets = computed(() =>
      props.lang === "zh"
        ? [
            { label: "总览帮助", cmd: "--help" },
            { label: "子命令帮助", cmd: "deploy --help" },
            {
              label: "预览生产部署",
              cmd: "deploy prod eu-west-1 -p 8080 -n -t v2",
            },
            { label: "JSON 输出", cmd: "deploy staging --json" },
            { label: "命令拼写纠错", cmd: "deply prod" },
            { label: "选项拼写纠错", cmd: "deploy prod --prt 8080" },
            { label: "范围校验报错", cmd: "deploy prod -p 70000" },
            { label: "互斥选项检测", cmd: "deploy prod --json --yaml" },
            { label: "调试日志 (-v)", cmd: "db migrate -s 2 -v" },
          ]
        : [
            { label: "Root --help", cmd: "--help" },
            { label: "Command --help", cmd: "deploy --help" },
            {
              label: "Dry-run deploy",
              cmd: "deploy prod eu-west-1 -p 8080 -n -t v2",
            },
            { label: "JSON mode", cmd: "deploy staging --json" },
            { label: "Command typo", cmd: "deply prod" },
            { label: "Flag typo", cmd: "deploy prod --prt 8080" },
            { label: "Range error", cmd: "deploy prod -p 70000" },
            { label: "Flag conflict", cmd: "deploy prod --json --yaml" },
            { label: "Verbose (-v)", cmd: "db migrate -s 2 -v" },
          ],
    );

    const evaluation = computed(() => evaluateCli(commandInput.value));

    return () => {
      const isZh = props.lang === "zh";
      const renderedLines = evaluation.value.lines.flatMap((line, li) => {
        const spans = line.map((seg, si) =>
          h("span", { key: `${li}-${si}`, class: seg.cls }, seg.text),
        );

        return li < evaluation.value.lines.length - 1
          ? [...spans, "\n"]
          : spans;
      });

      return h(
        "section",
        {
          "class": "pg-shell",
          "aria-label": isZh ? "交互式终端演示" : "Interactive CLI playground",
        },
        [
          h("div", { class: "pg-presets" }, [
            h(
              "span",
              { class: "pg-presets-label" },
              isZh ? "试一试：" : "Try:",
            ),
            ...presets.value.map((item) =>
              h(
                "button",
                {
                  "key": item.cmd,
                  "type": "button",
                  "aria-pressed": commandInput.value.trim() === item.cmd,
                  "class": [
                    "pg-chip",
                    { active: commandInput.value.trim() === item.cmd },
                  ],
                  "onClick": () => {
                    commandInput.value = item.cmd;
                    activeTab.value = "terminal";
                  },
                },
                item.label,
              ),
            ),
          ]),
          h("div", { class: "pg-window" }, [
            h("div", { class: "pg-toolbar" }, [
              h("div", { class: "pg-tabs", role: "tablist" }, [
                h(
                  "button",
                  {
                    "type": "button",
                    "role": "tab",
                    "aria-selected": activeTab.value === "terminal",
                    "class": [
                      "pg-tab",
                      { active: activeTab.value === "terminal" },
                    ],
                    "onClick": () => {
                      activeTab.value = "terminal";
                    },
                  },
                  isZh ? "实时终端" : "Live Terminal",
                ),
                h(
                  "button",
                  {
                    "type": "button",
                    "role": "tab",
                    "aria-selected": activeTab.value === "code",
                    "class": ["pg-tab", { active: activeTab.value === "code" }],
                    "onClick": () => {
                      activeTab.value = "code";
                    },
                  },
                  isZh ? "CLI 定义源码 (cli.ts)" : "CLI Source (cli.ts)",
                ),
              ]),
              h(
                "span",
                {
                  class: [
                    "pg-exit",
                    evaluation.value.exitCode === 0 ? "ok" : "err",
                  ],
                },
                `exit ${evaluation.value.exitCode}`,
              ),
            ]),
            activeTab.value === "terminal"
              ? h("div", { class: "pg-terminal" }, [
                  h("label", { class: "pg-prompt" }, [
                    h("span", { class: "t-muted" }, "$"),
                    h("span", { class: "pg-bin" }, "acme"),
                    h("input", {
                      "value": commandInput.value,
                      "type": "text",
                      "aria-label": isZh ? "命令行参数" : "Command arguments",
                      "spellcheck": false,
                      "autocomplete": "off",
                      "class": "pg-input",
                      "placeholder": isZh
                        ? "输入任意命令或参数，如 deploy prod -n 或 deply..."
                        : "Type any command, flags, or typo...",
                      "onInput": (e: Event) => {
                        commandInput.value = (
                          e.target as HTMLInputElement
                        ).value;
                      },
                    }),
                  ]),
                  h("pre", { class: "pg-output" }, [h("code", renderedLines)]),
                ])
              : h("pre", { class: "pg-code" }, [h("code", SOURCE_SNIPPET)]),
          ]),
        ],
      );
    };
  },
});
