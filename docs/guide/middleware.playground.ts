import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import {
  cli,
  command,
  middleware,
} from "../.vitepress/components/playground-runtime.ts";

export const onionState: PlaygroundScenario = {
  createCli: () => {
    const withTiming = middleware(async (ctx, next) => {
      ctx.log.debug("[1] timing start");
      try {
        await next();
      } finally {
        ctx.log.debug("[4] timing teardown (1.2ms)");
      }
    });

    const withDb = middleware({
      flags: { config: { type: String, default: "acme.sqlite" } },
      setup(ctx) {
        const db = {
          url: `sqlite://${ctx.flags.config}`,
          users: ["ray (admin)", "caelyreth (maintainer)"],
        };
        ctx.log.debug(`[2] opened ${db.url}`);

        return { db };
      },
      async run(ctx, next) {
        try {
          await next();
        } finally {
          ctx.log.debug(`[3] closed ${ctx.state.db.url}`);
        }
      },
    });

    return cli({
      name: "acme",
      version: "2.0.0",
      use: [withTiming, withDb],
      commands: [
        command("users", {
          use: [withDb],
          description: "List workspace users from ctx.state.db",
          run(ctx) {
            ctx.log.step(
              `Loaded ${ctx.state.db.users.length} users`,
              ctx.state.db.users.join(", "),
            );
          },
        }),
      ],
    });
  },
  presets: [
    { cmd: "users -v" },
    { cmd: "users --config prod.db -v" },
    { cmd: "users" },
  ],
};
