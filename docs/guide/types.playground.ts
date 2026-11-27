import type {
  PlaygroundScenario,
  TypeFunction,
} from "../.vitepress/components/playground-runtime.ts";
import {
  Types,
  cli,
  command,
} from "../.vitepress/components/playground-runtime.ts";

const parseKeyValue: TypeFunction<[string, string]> = (raw) => {
  const eq = raw.indexOf("=");
  if (eq <= 0) {
    throw new Error("expected KEY=VALUE format");
  }

  return [raw.slice(0, eq), raw.slice(eq + 1)];
};
parseKeyValue.display = "KEY=VALUE";

export const builtinTypes: PlaygroundScenario = {
  createCli: () =>
    cli({
      name: "acme",
      version: "2.0.0",
      commands: [
        command("release <channel>", {
          description: "Publish a validated release",
          args: {
            channel: {
              type: Types.Enum("alpha", "beta", "rc", "stable"),
              description: "Release channel",
            },
          },
          flags: {
            port: {
              type: Types.Integer({ min: 1, max: 65_535 }),
              default: 3000,
            },
            workers: { type: Types.Integer({ min: 1 }), default: 4 },
            tag: {
              type: Types.Regex(/^v\d+\.\d+$/, "v<major>.<minor>"),
              description: "Version tag",
            },
          },
          run({ args, flags, log }) {
            log.success(`Validated '${args.channel}' release`, flags);
          },
        }),
      ],
    }),
  presets: [
    { cmd: "release beta --tag v2.1" },
    { cmd: "release nightly" },
    { cmd: "release rc --workers 1.5" },
    { cmd: "release stable --tag 2.0" },
    { cmd: "release --help" },
  ],
};

export const customParser: PlaygroundScenario = {
  createCli: () =>
    cli({
      name: "acme",
      version: "2.0.0",
      commands: [
        command("env", {
          description: "Define build constants with custom KEY=VALUE parser",
          flags: {
            define: {
              type: parseKeyValue,
              multiple: true,
              short: "D",
              description: "Constants",
            },
          },
          run({ flags, log }) {
            log.info("Parsed define tuples", { define: flags.define });
          },
        }),
      ],
    }),
  presets: [
    { cmd: "env -D API=prod -D MOCK=0" },
    { cmd: "env -D INVALID" },
    { cmd: "env --help" },
  ],
};
