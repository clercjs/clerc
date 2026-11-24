import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import { Types, clerc } from "../.vitepress/components/playground-runtime.ts";

const scenario: PlaygroundScenario = {
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

export default scenario;
