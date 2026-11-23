import { clerc } from "clerc";

const cli = clerc({
  name: "bumpp",
  version: "9.2.0",
  description: "Interactive CLI that bumps your version numbers and more",
});

cli.command("[files...]", {
  description: "Bump your version numbers",
  flags: {
    preid: { type: String, description: "ID for prerelease" },
    all: { type: Boolean, description: "Include all files" },
    commit: { type: String, short: "c", description: "Commit message" },
    tag: { type: String, short: "t", description: "Tag name" },
    push: {
      type: Boolean,
      short: "p",
      description: "Push to remote",
      default: true,
    },
    yes: {
      type: Boolean,
      short: "y",
      description: "Skip confirmation",
      default: true,
    },
    recursive: {
      type: Boolean,
      short: "r",
      description: "Bump package.json files recursively",
    },
    verify: {
      type: Boolean,
      description: "Git verification",
      default: true,
    },
    ignoreScripts: {
      type: Boolean,
      description: "Ignore scripts",
    },
    quiet: { type: Boolean, description: "Quiet mode" },
    version: { type: String, short: "v", description: "Target version" },
    execute: {
      type: String,
      short: "x",
      description: "Commands to execute after version bumps",
    },
  },
  run(ctx) {
    ctx.terminal.stdout(
      `Bumping version:\n${JSON.stringify({ args: ctx.args, flags: ctx.flags }, null, 2)}`,
    );
  },
});

await cli.runMain();
