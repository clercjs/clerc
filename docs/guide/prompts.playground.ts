import { cli, command } from "clerc";

import type { PlaygroundScenario } from "../.vitepress/playground/runtime.ts";

export const taskSpinner: PlaygroundScenario = {
  live: true,
  createCli: (live) =>
    cli({
      name: "acme",
      version: "2.0.0",
      commands: [
        command("upload", {
          description:
            "Upload build artifacts with live animated ctx.log.task()",
          flags: {
            fail: { type: Boolean, description: "Simulate upload failure" },
          },
          async run({ flags, log }) {
            if (!live) {
              return;
            }
            await live.task(log, "Uploading artifacts...", async (s) => {
              await live.sleep(520);
              s.message("Compressing 14 chunks...");
              await live.sleep(560);
              s.message("Verifying sha256 checksums...");
              await live.sleep(520);
              if (flags.fail) {
                throw new Error("registry returned HTTP 503");
              }

              return "Uploaded 14 chunks in 420ms";
            });
          },
        }),
      ],
    }),
  presets: [{ cmd: "upload" }, { cmd: "upload --fail" }, { cmd: "upload -q" }],
};

export const manualSpinner: PlaygroundScenario = {
  createCli: () =>
    cli({
      name: "acme",
      version: "2.0.0",
      commands: [
        command("connect", {
          description: "Control spinner lifecycle manually",
          run() {},
        }),
      ],
    }),
  presets: [{ cmd: "connect" }],
  manualSpinner: {
    startText: "Connecting to cluster...",
    messages: [
      "Authenticating...",
      "Verifying TLS handshake...",
      "Syncing cluster state...",
    ],
    stopText: "Connected",
    cancelText: "Cancelled",
    errorText: "Connection refused",
  },
};

export const interactivePrompts: PlaygroundScenario = {
  live: true,
  createCli: (live) =>
    cli({
      name: "acme",
      version: "2.0.0",
      commands: [
        command("deploy", {
          description: "Interactive deploy wizard using prompts + log.task()",
          async run({ log }) {
            if (!live) {
              return;
            }
            const env = await live.select({
              message: "Select target environment",
              options: [
                { value: "staging", label: "staging", hint: "us-east-1" },
                { value: "prod", label: "prod", hint: "multi-region" },
              ],
            });
            if (live.isCancel(env)) {
              log.warn("Deployment cancelled.");

              return;
            }

            const confirmed = await live.confirm({
              message: `Deploy release to ${env}?`,
              initialValue: true,
            });
            if (live.isCancel(confirmed) || !confirmed) {
              log.warn("Deployment cancelled.");

              return;
            }

            await live.task(log, `Deploying to ${env}...`, async (s) => {
              await live.sleep(500);
              s.message(`Uploading bundle to ${env} edge nodes...`);
              await live.sleep(560);

              return `Deployed to ${env} successfully`;
            });
          },
        }),
      ],
    }),
  presets: [{ cmd: "deploy" }],
};
