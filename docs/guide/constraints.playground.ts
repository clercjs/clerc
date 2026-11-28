import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import {
  Types,
  cli,
  command,
  exclusive,
  group,
  oneOf,
  together,
} from "../.vitepress/components/playground-runtime.ts";

export const flagConstraints: PlaygroundScenario = {
  createCli: () =>
    cli({
      name: "acme",
      version: "2.0.0",
      commands: [
        command("serve <env>", {
          description:
            "Validate constraint combinators with discriminated union narrowing",
          args: { env: Types.Enum("staging", "prod") },
          flags: [
            oneOf(
              {
                token: {
                  type: String,
                  required: true,
                  env: "ACME_TOKEN",
                  description: "API token",
                },
              },
              {
                tokenFile: {
                  type: String,
                  required: true,
                  env: "ACME_TOKEN_FILE",
                  description: "Path to token file",
                },
              },
            ),
            exclusive(
              { json: { type: Boolean, description: "Output JSON" } },
              { yaml: { type: Boolean, description: "Output YAML" } },
            ),
            group(
              "TLS Options",
              together({
                tlsKey: {
                  type: String,
                  required: true,
                  description: "TLS private key",
                },
                tlsCert: {
                  type: String,
                  required: true,
                  description: "TLS certificate",
                },
              }),
            ),
          ],
          run({ args, flags, log }) {
            const auth = flags.token ?? `file:${flags.tokenFile}`;
            log.success("Server configured", { env: args.env, auth, ...flags });
          },
        }),
      ],
    }),
  presets: [
    { cmd: "serve prod --token sec_1 --tls-key key.pem" },
    { cmd: "serve prod --token sec_1 --json --yaml" },
    { cmd: "serve prod" },
    { cmd: "serve --help" },
  ],
};

export const customChecks: PlaygroundScenario = {
  createCli: () =>
    cli({
      name: "acme",
      version: "2.0.0",
      flags: exclusive(
        { json: { type: Boolean, description: "Output JSON" } },
        { yaml: { type: Boolean, description: "Output YAML" } },
      ),
      commands: [
        command("listen", {
          description: "Start HTTP server with custom port check",
          flags: {
            port: {
              type: Number,
              short: "p",
              default: 3000,
              description: "Port (below 1024 requires --sudo)",
            },
            sudo: { type: Boolean, description: "Allow privileged ports" },
          },
          check({ flags }) {
            if (flags.port < 1024 && !flags.sudo) {
              return "ports below 1024 require '--sudo'";
            }
          },
          run({ flags, log }) {
            log.success(`Listening on port ${flags.port}`);
          },
        }),
      ],
    }),
  presets: [
    { cmd: "listen -p 80" },
    { cmd: "listen -p 80 --sudo" },
    { cmd: "listen --json --yaml" },
    { cmd: "listen --help" },
  ],
};
