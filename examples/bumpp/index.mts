import { Cli } from "clerc";

await Cli({
  scriptName: "bumpp",
  description: "Interactive CLI that bumps your version numbers and more",
  version: "9.2.0",
})
  .command("", {
    description: "Bump your version numbers",
    parameters: ["[files...]"] as const,
    flags: {
      preid: {
        type: String,
        description: "ID for prerelease",
      },
      all: {
        type: Boolean,
        description: "Include all files",
        default: false,
      },
      commit: {
        type: String,
        short: "c",
        description: "Commit message",
      },
      noCommit: {
        type: Boolean,
        description: "Skip commit",
        default: true,
      },
      tag: {
        type: String,
        short: "t",
        description: "Tag name",
      },
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
        default: false,
      },
      noVerify: {
        type: Boolean,
        description: "Skip git verification",
        default: true,
      },
      ignoreScripts: {
        type: Boolean,
        description: "Ignore scripts",
        default: false,
      },
      quiet: {
        type: Boolean,
        description: "Quiet mode",
        default: false,
      },
      version: {
        type: String,
        short: "v",
        description: "Target version",
      },
      execute: {
        type: String,
        short: "x",
        description: "Commands to execute after version bumps",
      },
    },
    run: (ctx) => {
      ctx.log.info(
        `Bumping version:\n${JSON.stringify({ parameters: ctx.parameters, flags: ctx.flags }, null, 2)}`,
      );
    },
  })
  .runMain();
