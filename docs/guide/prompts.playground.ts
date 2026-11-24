import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import { clerc } from "../.vitepress/components/playground-runtime.ts";

const scenario: PlaygroundScenario = {
  createCli: () =>
    clerc({ name: "acme", version: "2.0.0" }).command("upload", {
      description: "Upload build artifacts with ctx.log.task()",
      flags: {
        fail: { type: Boolean, description: "Simulate upload failure" },
      },
      async run({ flags, log }) {
        await log.task("Uploading artifacts...", async (s) => {
          s.message("Compressing 14 chunks...");
          s.message("Verifying sha256 checksums...");
          if (flags.fail) {
            throw new Error("registry returned HTTP 503");
          }

          return "Uploaded 14 chunks in 420ms";
        });
      },
    }),
  source: `cli.command("upload", {
  flags: { fail: Boolean },
  async run({ flags, log }) {
    await log.task("Uploading artifacts...", async (s) => {
      s.message("Compressing 14 chunks...");
      s.message("Verifying sha256 checksums...");
      if (flags.fail) throw new Error("registry returned HTTP 503");
      return "Uploaded 14 chunks in 420ms";
    });
  },
});`,
  presets: [{ cmd: "upload" }, { cmd: "upload --fail" }, { cmd: "upload -q" }],
};

export default scenario;
