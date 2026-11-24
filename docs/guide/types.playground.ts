import type {
  PlaygroundScenario,
  TypeFunction,
} from "../.vitepress/components/playground-runtime.ts";
import { Types, clerc } from "../.vitepress/components/playground-runtime.ts";

const parseKeyValue: TypeFunction<[string, string]> = (raw) => {
  const eq = raw.indexOf("=");
  if (eq <= 0) {
    throw new Error("expected KEY=VALUE format");
  }

  return [raw.slice(0, eq), raw.slice(eq + 1)];
};
parseKeyValue.display = "KEY=VALUE";

const scenario: PlaygroundScenario = {
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
          define: flags.define,
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

export default scenario;
