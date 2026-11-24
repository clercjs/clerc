import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import { Types, clerc } from "../.vitepress/components/playground-runtime.ts";

export const declarativeRules: PlaygroundScenario = {
  createCli: () =>
    clerc({ name: "acme", version: "2.0.0" }).command("serve [env]", {
      description: "Validate declarative rules across flags and arguments",
      args: { env: Types.Enum("staging", "prod") },
      flags: {
        all: { type: Boolean, description: "Target all environments" },
        json: { type: Boolean, description: "Output JSON" },
        yaml: { type: Boolean, description: "Output YAML" },
        tlsKey: { type: String, description: "TLS private key" },
        tlsCert: { type: String, description: "TLS certificate" },
      },
      rules: ({ exclusive, together, oneOf, flag, arg }) => [
        exclusive(flag("json"), flag("yaml")),
        together(flag("tlsKey"), flag("tlsCert")),
        oneOf(arg("env"), flag("all")),
      ],
      run({ args, flags, log }) {
        log.success("Server configured", { env: args.env, ...flags });
      },
    }),
  presets: [
    { cmd: "serve prod --tls-key key.pem" },
    { cmd: "serve prod --json --yaml" },
    { cmd: "serve" },
    { cmd: "serve --help" },
  ],
};

export const customRules: PlaygroundScenario = {
  createCli: () =>
    clerc({ name: "acme", version: "2.0.0" })
      .flags({
        json: { type: Boolean, description: "Output JSON" },
        yaml: { type: Boolean, description: "Output YAML" },
      })
      .rules(({ exclusive, flag }) => [exclusive(flag("json"), flag("yaml"))])
      .command("listen", {
        description: "Start HTTP server with custom port guard",
        flags: {
          port: {
            type: Number,
            short: "p",
            default: 3000,
            description: "Port",
          },
          sudo: { type: Boolean, description: "Allow privileged ports" },
        },
        rules: () => [
          ({ flags }) => {
            if (flags.port < 1024 && !flags.sudo) {
              return "ports below 1024 require --sudo";
            }
          },
        ],
        run({ flags, log }) {
          log.success(`Listening on port ${flags.port}`);
        },
      }),
  presets: [
    { cmd: "listen -p 80" },
    { cmd: "listen -p 80 --sudo" },
    { cmd: "listen --json --yaml" },
  ],
};
