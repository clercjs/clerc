import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import { clerc } from "../.vitepress/components/playground-runtime.ts";

const scenario: PlaygroundScenario = {
  createCli: () =>
    clerc({ name: "acme", version: "2.0.0" })
      .flags({ config: { type: String, default: "acme.sqlite" } })
      .middleware(async (ctx, next) => {
        ctx.log.debug("[1] timing start");
        try {
          await next();
        } finally {
          ctx.log.debug("[4] timing teardown (1.2ms)");
        }
      })
      .middleware(async (ctx, next) => {
        const db = {
          url: `sqlite://${ctx.flags.config}`,
          users: ["ray (admin)", "caelyreth (maintainer)"],
        };
        ctx.log.debug(`[2] opened ${db.url}`);
        try {
          return await next({ db });
        } finally {
          ctx.log.debug(`[3] closed ${db.url}`);
        }
      })
      .command("users", {
        description: "List workspace users from ctx.state.db",
        run(ctx) {
          ctx.log.step(
            `Loaded ${ctx.state.db.users.length} users`,
            ctx.state.db.users.join(", "),
          );
        },
      }),
  source: `const cli = clerc({ name: "acme", version: "2.0.0" })
  .flags({ config: { type: String, default: "acme.sqlite" } })
  .middleware(async (ctx, next) => {
    const db = { url: \`sqlite://\${ctx.flags.config}\`, users: ["ray", "caelyreth"] };
    ctx.log.debug(\`opened \${db.url}\`);
    try {
      return await next({ db });
    } finally {
      ctx.log.debug(\`closed \${db.url}\`);
    }
  })
  .command("users", {
    run(ctx) { ctx.log.step("Users", ctx.state.db.users.join(", ")); },
  });`,
  presets: [
    { cmd: "users -v" },
    { cmd: "users --config prod.db -v" },
    { cmd: "users" },
    { cmd: "users --help" },
  ],
};

export default scenario;
