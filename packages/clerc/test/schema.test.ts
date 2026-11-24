import { createMemoryTerminal, createTestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import type { StandardSchemaV1 } from "../src";
import { InvalidSchemaError, RuleError, Types, ValidationError } from "../src";

const createSyncSchema = <T>(
  validate: (
    input: unknown,
  ) => { value: T } | { issues: { message: string }[] },
): StandardSchemaV1<unknown, T> => ({
  "~standard": {
    version: 1,
    vendor: "test",
    validate,
  },
});

const createAsyncSchema = <T>(
  validate: (
    input: unknown,
  ) => Promise<{ value: T } | { issues: { message: string }[] }>,
): StandardSchemaV1<unknown, T> => ({
  "~standard": {
    version: 1,
    vendor: "test-async",
    validate,
  },
});

describe("Types and Standard Schema v1", () => {
  it("validates built-in Types.Enum, Integer, Number, String, Regex, Counter", async () => {
    let captured: any;
    const terminal = createMemoryTerminal();

    const cli = createTestBaseCli();
    cli.command("run <env>", {
      args: { env: Types.Enum("dev", "prod") },
      flags: {
        port: { type: Types.Integer({ min: 1, max: 65_535 }) },
        ratio: { type: Types.Number({ min: 0, max: 1 }) },
        token: { type: Types.String({ trim: true, nonEmpty: true }) },
        tag: { type: Types.Regex(/^v\d+$/g, "v<n>"), multiple: true },
        verbose: { type: Types.Counter, short: "v" },
        workers: { type: Types.Integer() },
      },
      run(ctx) {
        captured = { args: ctx.args, flags: ctx.flags };
      },
    });

    await cli.run(
      [
        "run",
        "prod",
        "--port",
        "8080",
        "--ratio",
        "0.5",
        "--token",
        "  abc  ",
        "--tag",
        "v2",
        "--tag",
        "v3",
        "--workers",
        "4",
        "-vv",
      ],
      { terminal },
    );

    expect(captured).toEqual({
      args: { env: "prod" },
      flags: {
        port: 8080,
        ratio: 0.5,
        token: "abc",
        tag: ["v2", "v3"],
        workers: 4,
        verbose: 2,
      },
    });

    await expect(
      cli.run(["run", "qa"], { terminal, throwOnError: true }),
    ).rejects.toThrow(ValidationError);

    await expect(
      cli.run(["run", "dev", "--port", "99999"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      cli.run(["run", "dev", "--workers", "1.5"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      cli.run(["run", "dev", "--workers", ""], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      cli.run(["run", "dev", "--port", "80.5"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      cli.run(["run", "dev", "--token", "   "], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(ValidationError);

    expect(() => Types.Enum()).toThrow(InvalidSchemaError);
    expect(() => Types.Integer({ min: 10, max: 5 })).toThrow(
      InvalidSchemaError,
    );
    expect(() => Types.Number({ min: 10, max: 5 })).toThrow(InvalidSchemaError);
    expect(() => Types.String({ minLength: 5, maxLength: 2 })).toThrow(
      InvalidSchemaError,
    );
  });

  it("supports sync and async Standard Schema v1 on flags and args", async () => {
    const emailSchema = createSyncSchema<string>((val) => {
      if (typeof val === "string" && val.includes("@")) {
        return { value: val.toLowerCase() };
      }

      return { issues: [{ message: "must be a valid email address" }] };
    });

    const asyncUpperSchema = createAsyncSchema<string>(async (val) => {
      if (typeof val === "string" && val.length >= 2) {
        return { value: val.toUpperCase() };
      }

      return { issues: [{ message: "must be at least 2 characters" }] };
    });

    let captured: any;
    const terminal = createMemoryTerminal();

    const cli = createTestBaseCli();
    cli.command("invite <code-id>", {
      args: { codeId: asyncUpperSchema },
      flags: {
        email: { type: emailSchema, required: true },
      },
      run(ctx) {
        captured = { args: ctx.args, flags: ctx.flags };
      },
    });

    await cli.run(["invite", "ab", "--email", "Ray@Example.COM"], { terminal });

    expect(captured).toEqual({
      args: { codeId: "AB" },
      flags: { email: "ray@example.com" },
    });

    const res = await cli.run(["invite", "ab", "--email", "invalid"], {
      terminal,
    });

    expect(res.ok).toBeFalsy();
    expect(res.exitCode).toBe(2);
    expect(res.error).toBeInstanceOf(ValidationError);
    expect((res.error as ValidationError).detail).toContain(
      "must be a valid email address",
    );
  });

  it("enforces array constraints (unique, minItems, maxItems) on multiple flags and variadic args", async () => {
    let captured: any;
    const terminal = createMemoryTerminal();
    const cli = createTestBaseCli();

    cli.command("order <ids...>", {
      args: {
        ids: { unique: true, minItems: 2, maxItems: 4 },
      },
      flags: {
        tags: {
          type: String,
          multiple: true,
          delimiter: ",",
          unique: true,
          minItems: 1,
          maxItems: 3,
        },
      },
      run(ctx) {
        captured = { args: ctx.args, flags: ctx.flags };
      },
    });

    // Valid call (optional --tags omitted does not fail minItems)
    await cli.run(["order", "a", "b", "c"], { terminal });

    expect(captured).toEqual({
      args: { ids: ["a", "b", "c"] },
      flags: { tags: [] },
    });

    // Valid --tags
    await cli.run(["order", "a", "b", "--tags", "x,y"], { terminal });

    expect(captured.flags.tags).toEqual(["x", "y"]);

    // Duplicate variadic arg
    await expect(
      cli.run(["order", "a", "b", "a"], { terminal, throwOnError: true }),
    ).rejects.toThrow(ValidationError);

    // Too few / too many variadic args
    await expect(
      cli.run(["order", "only-one"], { terminal, throwOnError: true }),
    ).rejects.toThrow(ValidationError);
    await expect(
      cli.run(["order", "1", "2", "3", "4", "5"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(ValidationError);

    // Duplicate / too many multiple flag items
    await expect(
      cli.run(["order", "a", "b", "--tags", "x,x"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(ValidationError);
    await expect(
      cli.run(["order", "a", "b", "--tags", "1,2,3,4"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(ValidationError);

    // Compile-time schema errors for non-array targets or invalid bounds
    const badFlagCli = createTestBaseCli().command("bad", {
      flags: { single: { type: String, unique: true } },
    });

    expect(() => badFlagCli.buildModel()).toThrow(InvalidSchemaError);

    const badArgCli = createTestBaseCli().command("bad <id>", {
      args: { id: { minItems: 1 } },
    });

    expect(() => badArgCli.buildModel()).toThrow(InvalidSchemaError);
  });

  it("supports r.group(), auto env hints, structured custom rule failures, documented constraints, and composable rules arrays", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestBaseCli({ help: true }).groups({
      flags: { fields: "Monitor Fields" },
    });

    const authRules = (r: any) => [
      r.oneOf([r.flag("token"), r.flag("tokenFile")]),
    ];

    cli.command("edit", {
      flags: {
        token: { type: String, env: "API_TOKEN" },
        tokenFile: { type: String, env: "API_TOKEN_FILE" },
        name: { type: String, group: "fields" },
        url: { type: String, group: "fields" },
        statusMin: {
          type: Types.Integer({ min: 100, max: 599 }),
          group: "fields",
        },
        statusMax: {
          type: Types.Integer({ min: 100, max: 599 }),
          group: "fields",
        },
        body: { type: String, group: "fields" },
      },
      rules: [
        authRules,
        (r) => [r.atLeastOne(r.group("fields"))],
        {
          description: "--status-max must be >= --status-min",
          check({ flags }) {
            if (
              flags.statusMin !== undefined &&
              flags.statusMax !== undefined &&
              flags.statusMax < flags.statusMin
            ) {
              return {
                message: "'--status-max' must be >= '--status-min'",
                detail: `got min=${flags.statusMin}, max=${flags.statusMax}`,
                hints: ["pass a status-max >= status-min"],
              };
            }
          },
        },
      ],
      run() {},
    });

    // Auto env hints on oneOf failure
    const missingAuth = await cli.run(["edit", "--name", "web"], { terminal });

    expect(missingAuth.ok).toBeFalsy();
    expect(missingAuth.error).toBeInstanceOf(RuleError);
    expect((missingAuth.error as RuleError).hints[0]).toContain("API_TOKEN");
    expect((missingAuth.error as RuleError).hints[0]).toContain(
      "API_TOKEN_FILE",
    );

    // r.atLeastOne(r.group("fields")) triggers when no field flag is passed
    const missingField = await cli.run(["edit", "--token", "abc"], {
      terminal,
    });

    expect(missingField.ok).toBeFalsy();
    expect(missingField.error).toBeInstanceOf(RuleError);

    // Structured custom rule failure includes detail & hints
    const badRange = await cli.run(
      ["edit", "--token", "abc", "--status-min", "400", "--status-max", "200"],
      { terminal },
    );

    expect(badRange.ok).toBeFalsy();
    expect(badRange.error).toBeInstanceOf(RuleError);
    expect((badRange.error as RuleError).detail).toContain("min=400, max=200");
    expect((badRange.error as RuleError).hints).toContain(
      "pass a status-max >= status-min",
    );

    // Help renders group badge on heading, inline oneOf tag, and custom rule under NOTES
    terminal.clear();
    await cli.run(["edit", "--help"], { terminal });
    const help = terminal.stdoutText();

    expect(help).not.toContain("CONSTRAINTS");
    expect(help).toContain("MONITOR FIELDS  [at least one]");
    expect(help).toContain("[one of: --token, --token-file]");
    expect(help).toContain("NOTES\n  --status-max must be >= --status-min");
  });
});
