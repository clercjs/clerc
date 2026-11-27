import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import {
  ClercError,
  cli,
  command,
  group,
  middleware,
  use,
} from "../.vitepress/components/playground-runtime.ts";

const withAuth = (defaultRole = "viewer") =>
  middleware({
    flags: {
      token: { type: String, description: "API authentication token" },
    },
    setup(ctx) {
      const user = ctx.flags.token
        ? { name: "ray", role: "admin" as const }
        : { name: "guest", role: defaultRole };

      return { user };
    },
  });

const withRbac = middleware(async (ctx, next) => {
  const perms = ctx.command.meta?.permissions as readonly string[] | undefined;
  const user = (ctx.state as { readonly user?: { readonly role: string } })
    .user;
  if (perms?.includes("admin") && user?.role !== "admin") {
    throw new ClercError("admin permission required", {
      code: "ERR_FORBIDDEN",
      detail: `Current role is '${user?.role ?? "guest"}'`,
    }).addHint("pass '--token <secret>' to authenticate as admin");
  }

  await next();
});

export const authPluginDemo: PlaygroundScenario = {
  createCli: () => {
    const auth = withAuth();

    return cli({
      name: "acme",
      version: "2.0.0",
      commands: [
        group(
          "Account",
          use(auth, [
            command("whoami", {
              use: [auth],
              description: "Show current authenticated identity",
              run(ctx) {
                ctx.log.info(`${ctx.state.user.name} (${ctx.state.user.role})`);
              },
            }),
          ]),
        ),
        command("ping", {
          description: "Public health check (no --token flag)",
          run(ctx) {
            ctx.log.success("pong");
          },
        }),
      ],
    });
  },
  presets: [
    { cmd: "whoami" },
    { cmd: "whoami --token sec_live_99" },
    { cmd: "--help" },
  ],
};

export const rbacMetaDemo: PlaygroundScenario = {
  createCli: () => {
    const auth = withAuth();

    return cli({
      name: "acme",
      version: "2.0.0",
      use: [auth, withRbac],
      commands: [
        command("nuke", {
          use: [auth],
          description: "Delete staging cluster (admin only)",
          meta: { permissions: ["admin"] },
          run(ctx) {
            ctx.log.box.warn(
              "Cluster deleted",
              `Authorized by ${ctx.state.user.name}.`,
            );
          },
        }),
      ],
    });
  },
  presets: [{ cmd: "nuke" }, { cmd: "nuke --token sec_live_99" }],
};
