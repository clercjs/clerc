import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import {
  ClercError,
  clerc,
  plugin,
} from "../.vitepress/components/playground-runtime.ts";

const scenario: PlaygroundScenario = {
  createCli: () => {
    const authPlugin = (defaultRole = "viewer") =>
      plugin("acme:auth")
        .flags({
          token: { type: String, description: "API authentication token" },
        })
        .middleware((ctx, next) => {
          const user = ctx.flags.token
            ? { name: "ray", role: "admin" as const }
            : { name: "guest", role: defaultRole };

          return next({ user });
        });

    const rbacPlugin = plugin("acme:rbac").middleware(
      (ctx, next) => {
        const perms = ctx.command.meta?.permissions as
          readonly string[] | undefined;
        const user = (
          ctx.state as { readonly user?: { readonly role: string } }
        ).user;
        if (perms?.includes("admin") && user?.role !== "admin") {
          throw new ClercError("admin permission required", {
            code: "ERR_VALIDATION",
            detail: `Current role is '${user?.role ?? "guest"}'`,
          }).addHint("pass '--token <secret>' to authenticate as admin");
        }

        return next();
      },
      { enforce: "post" },
    );

    return clerc({ name: "acme", version: "2.0.0" })
      .use(authPlugin())
      .use(rbacPlugin)
      .command("whoami", {
        description: "Show current authenticated identity",
        run(ctx) {
          ctx.log.info(`${ctx.state.user.name} (${ctx.state.user.role})`);
        },
      })
      .command("nuke", {
        description: "Delete staging cluster (admin only)",
        meta: { permissions: ["admin"] },
        run(ctx) {
          ctx.log.box.warn(
            "Cluster deleted",
            `Authorized by ${ctx.state.user.name}.`,
          );
        },
      });
  },
  source: `const authPlugin = (defaultRole = "viewer") =>
  plugin("acme:auth")
    .flags({ token: String })
    .middleware((ctx, next) =>
      next({
        user: ctx.flags.token
          ? { name: "ray", role: "admin" }
          : { name: "guest", role: defaultRole },
      }),
    );

const cli = clerc({ name: "acme", version: "2.0.0" })
  .use(authPlugin())
  .use(rbacPlugin) // enforce: "post", checks command.meta.permissions
  .command("whoami", { run(ctx) { ctx.log.info(ctx.state.user); } })
  .command("nuke", { meta: { permissions: ["admin"] }, run() {} });`,
  presets: [
    { cmd: "whoami" },
    { cmd: "whoami --token sec_live_99" },
    { cmd: "nuke" },
    { cmd: "nuke --token sec_live_99" },
  ],
};

export default scenario;
