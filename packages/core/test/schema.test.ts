import { createMemoryTerminal, createTestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import type { StandardSchemaV1 } from "../src";
import { Types, ValidationError } from "../src";

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
  it("validates built-in Types.Enum, Range, Regex, Integer", async () => {
    let captured: any;
    const terminal = createMemoryTerminal();

    const cli = createTestBaseCli().command("run", {
      parameters: [{ key: "<env>", type: Types.Enum("dev", "prod") }] as const,
      flags: {
        port: { type: Types.Range(1, 65_535) },
        tag: { type: Types.Regex(/^v\d+$/, "v<n>") },
        workers: { type: Types.Integer },
      },
      run: (ctx) => {
        captured = { params: ctx.parameters, flags: ctx.flags };
      },
    });

    await cli.run(
      ["run", "prod", "--port", "8080", "--tag", "v2", "--workers", "4"],
      { terminal },
    );

    expect(captured).toEqual({
      params: { env: "prod" },
      flags: { port: 8080, tag: "v2", workers: 4 },
    });

    await expect(cli.run(["run", "qa"], { terminal })).rejects.toThrow(
      ValidationError,
    );

    await expect(
      cli.run(["run", "dev", "--port", "99999"], { terminal }),
    ).rejects.toThrow(ValidationError);

    await expect(
      cli.run(["run", "dev", "--workers", "1.5"], { terminal }),
    ).rejects.toThrow(ValidationError);
  });

  it("supports sync and async Standard Schema v1 on flags and parameters", async () => {
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

    const cli = createTestBaseCli().command("invite", {
      parameters: [{ key: "<codeId>", type: asyncUpperSchema }] as const,
      flags: {
        email: { type: emailSchema, required: true },
      },
      run: (ctx) => {
        captured = { params: ctx.parameters, flags: ctx.flags };
      },
    });

    await cli.run(["invite", "ab", "--email", "Ray@Example.COM"], { terminal });

    expect(captured).toEqual({
      params: { codeId: "AB" },
      flags: { email: "ray@example.com" },
    });

    const res = await cli.run(["invite", "ab", "--email", "invalid"], {
      terminal,
      throwOnUnhandled: false,
    });

    expect(res.ok).toBeFalsy();
    expect(res.exitCode).toBe(2);
    expect(res.error).toBeInstanceOf(ValidationError);
    expect((res.error as ValidationError).detail).toContain(
      "must be a valid email address",
    );
  });
});
