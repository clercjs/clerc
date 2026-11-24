import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import {
  Types,
  clerc,
  plugin,
} from "../.vitepress/components/playground-runtime.ts";

const scenario: PlaygroundScenario = {
  createCli: () => {
    const dbPlugin = plugin("acme:db")
      .command("db", { group: "db", description: "Database management" })
      .command("db migrate", {
        aliases: "m",
        group: "db",
        description: "Run pending database migrations",
        flags: {
          steps: {
            type: Types.Integer(),
            short: "s",
            description: "Max steps",
          },
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
            type: Types.Integer({ min: 1, max: 65_535 }),
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
            description: "Output JSON summary",
          },
          yaml: { type: Boolean, description: "Output YAML summary" },
        },
        rules: ({ exclusive, flag }) => [exclusive(flag("json"), flag("yaml"))],
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
      type: Types.Integer({ min: 1, max: 65_535 }),
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
    json: Boolean,
    yaml: Boolean,
  },
  rules: ({ exclusive, flag }) => [exclusive(flag("json"), flag("yaml"))],
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

export default scenario;
