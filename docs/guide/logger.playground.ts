import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import { cli, command } from "../.vitepress/components/playground-runtime.ts";

export const alignedOutput: PlaygroundScenario = {
  createCli: () =>
    cli({
      name: "acme",
      version: "2.0.0",
      commands: [
        command("build", {
          description: "Preview aligned log levels, .line(), and Error chains",
          flags: {
            fail: { type: Boolean, description: "Log Error with cause chain" },
          },
          run({ flags, log }) {
            const step = log.step("Building targets");
            step.line("0001_bundle.mjs (12ms)");
            step.line("0002_types.d.mts (8ms)");

            log.info("Resolved config", { port: 3000, cache: true });
            log.child("db").child("migrate").debug("Query finished in 1.2ms");

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
      ],
    }),
  presets: [{ cmd: "build -v" }, { cmd: "build --fail" }],
};

export const calloutBox: PlaygroundScenario = {
  createCli: () =>
    cli({
      name: "acme",
      version: "2.0.0",
      commands: [
        command("deploy", {
          description: "Preview log.box.* callout panels",
          flags: {
            confirm: { type: Boolean, description: "Execute real deploy" },
          },
          run({ flags, log }) {
            if (flags.confirm) {
              log.box.success("Deployment live", "Published v2.0.0 to prod.");
            } else {
              log.box.warn(
                "Dry run mode",
                "No remote changes were written.",
                `Pass ${log.theme.accent("--confirm")} to execute.`,
              );
            }
          },
        }),
      ],
    }),
  presets: [{ cmd: "deploy" }, { cmd: "deploy --confirm" }],
};

export const logLevels: PlaygroundScenario = {
  createCli: () =>
    cli({
      name: "acme",
      version: "2.0.0",
      commands: [
        command("inspect", {
          description: "Preview verbosity levels and raw JSON output",
          flags: {
            json: { type: Boolean, description: "Print raw JSON payload" },
          },
          run({ flags, log }) {
            const config = { port: 3000, cache: true };
            if (flags.json) {
              log.raw(JSON.stringify(config, null, 2));

              return;
            }
            log.debug("Loaded acme.config.ts");
            log.info("Resolved config", config);
            log.success("Ready");
          },
        }),
      ],
    }),
  presets: [
    { cmd: "inspect -v" },
    { cmd: "inspect -q" },
    { cmd: "inspect --json" },
  ],
};
