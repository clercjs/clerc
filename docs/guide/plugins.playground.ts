import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import {
  ClercError,
  clerc,
  plugin,
} from "../.vitepress/components/playground-runtime.ts";

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
    const user = (ctx.state as { readonly user?: { readonly role: string } })
      .user;
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

export const authPluginDemo: PlaygroundScenario = {
  createCli: () =>
    clerc({ name: "acme", version: "2.0.0" })
      .use(authPlugin())
      .command("whoami", {
        description: "Show current authenticated identity",
        run(ctx) {
          ctx.log.info(`${ctx.state.user.name} (${ctx.state.user.role})`);
        },
      }),
  presets: [{ cmd: "whoami" }, { cmd: "whoami --token sec_live_99" }],
};

export const rbacMetaDemo: PlaygroundScenario = {
  createCli: () =>
    clerc({ name: "acme", version: "2.0.0" })
      .use(authPlugin())
      .use(rbacPlugin)
      .command("nuke", {
        description: "Delete staging cluster (admin only)",
        meta: { permissions: ["admin"] },
        run(ctx) {
          ctx.log.box.warn(
            "Cluster deleted",
            `Authorized by ${ctx.state.user.name}.`,
          );
        },
      }),
  presets: [{ cmd: "nuke" }, { cmd: "nuke --token sec_live_99" }],
};
