import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import { clerc } from "../.vitepress/components/playground-runtime.ts";

const scenario: PlaygroundScenario = {
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

export default scenario;
